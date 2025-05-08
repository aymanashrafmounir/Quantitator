import random
import pandas as pd
import math
import logging
import json
import argparse
import os
from typing import List, Dict, Tuple

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(filename='ga.log', level=logging.DEBUG)


# --- Chromosome ---
class Chromosome:
    def __init__(self, bits_per_product: int, num_products: int, bitstring: str = None):
        self.bits_per_product = bits_per_product
        self.num_products = num_products
        if bitstring:
            self.bitstring = bitstring
        else:
            self.bitstring = ''.join(random.choice('01') for _ in range(bits_per_product * num_products))
        logger.debug(f"Init Chrom: {self.bitstring}")

    def decode(self) -> List[int]:
        quant = []
        for i in range(self.num_products):
            seg = self.bitstring[i*self.bits_per_product:(i+1)*self.bits_per_product]
            quant.append(int(seg, 2))
        logger.debug(f"Decoded: {quant}")
        return quant

    def clone(self) -> 'Chromosome':
        return Chromosome(self.bits_per_product, self.num_products, self.bitstring)

    def repair(self, params: List[Dict[str, float]], Bp, Bm, BL, S_max) -> None:
        quantities = self.decode()
        # Demand repair
        for i, q in enumerate(quantities):
            max_q = params[i]['D_e'] - params[i]['s_old']
            quantities[i] = min(q, max(0, int(max_q)))
        # Budget repair
        def budget_ok(qs):
            return (sum(params[i]['cp']*qs[i] for i in range(len(qs))) <= Bp and
                    sum(params[i]['cm']*qs[i] for i in range(len(qs))) <= Bm and
                    sum(params[i]['cl']*qs[i] for i in range(len(qs))) <= BL)
        while not budget_ok(quantities):
            idx = max(range(len(quantities)), key=lambda i: quantities[i] * (
                    params[i]['cp'] + params[i]['cm'] + params[i]['cl']))
            if quantities[idx] > 0:
                quantities[idx] -= 1
            else:
                break
        # Encode back
        bits = [format(q, 'b').zfill(self.bits_per_product) for q in quantities]
        self.bitstring = ''.join(bits)
        logger.debug(f"Repaired Chrom: {self.bitstring}")

# --- Constraint Check ---
def check_constraints(
        quantities: List[int],
        params: List[Dict[str, float]],
        Bp: float,
        Bm: float,
        BL: float,
        S_max: float
) -> bool:
    # Budget calculations
    prod_cost = sum(params[i]['cp'] * q for i, q in enumerate(quantities))
    market_cost = sum(params[i]['cm'] * q for i, q in enumerate(quantities))
    log_cost = sum(params[i]['cl'] * q for i, q in enumerate(quantities))

    if prod_cost > Bp:
        logger.warning(f"Production budget violated: total={prod_cost:.2f}, limit={Bp}")
        return False
    if market_cost > Bm:
        logger.warning(f"Marketing budget violated: total={market_cost:.2f}, limit={Bm}")
        return False
    if log_cost > BL:
        logger.warning(f"Logistics budget violated: total={log_cost:.2f}, limit={BL}")
        return False

    # Demand constraints
    for i, q in enumerate(quantities):
        total = q + params[i]['s_old']
        if total > params[i]['D_e']:
            logger.warning(
                f"Demand constraint violated at product {i}: x_i={q}, s_old={params[i]['s_old']}, "
                f"D_e={params[i]['D_e']}, total={total}"
            )
            return False

    # Shelf space constraint
    shelf_used = sum(params[i]['S_i'] * (quantities[i] + params[i]['s_old']) for i in range(len(quantities)))
    if shelf_used > S_max:
        logger.warning(f"Shelf space constraint violated: used={shelf_used:.2f}, max={S_max}")
        return False

    return True


# --- GA Operators ---
def fitness_and_penalties(q: List[int], params: List[Dict[str, float]], d_base, age_max, s_max) -> Tuple[float, List[float], List[float]]:
    penalties, profits = [], []
    total = 0.0
    for x, p in zip(q, params):
        rev = p['pr'] * x
        cost_u = p['cp'] + p['cm'] + p['cl'] + p['cs']
        cost = cost_u * x
        pe = d_base * (p['age']/age_max) * (p['s_old']/s_max)
        pen = (rev - cost) * pe
        profit_i = (rev - cost) - pen
        penalties.append(pen)
        profits.append(profit_i)
        total += profit_i
    return total, penalties, profits

def tournament_selection(pop, fits, k=3) -> Chromosome:
    candidates = random.sample(list(zip(pop, fits)), k)
    winner = max(candidates, key=lambda x: x[1])[0]
    return winner.clone()

def one_point_crossover(p1: Chromosome, p2: Chromosome) -> Tuple[Chromosome, Chromosome]:
    n = len(p1.bitstring)
    pt = random.randint(1, n-1)
    c1 = p1.bitstring[:pt] + p2.bitstring[pt:]
    c2 = p2.bitstring[:pt] + p1.bitstring[pt:]
    return Chromosome(p1.bits_per_product, p1.num_products, c1), Chromosome(p2.bits_per_product, p2.num_products, c2)

def mutate(ch: Chromosome, mu: float) -> None:
    bits = list(ch.bitstring)
    for i in range(len(bits)):
        if random.random() < mu:
            bits[i] = '1' if bits[i]=='0' else '0'
    ch.bitstring = ''.join(bits)

# --- GA Runner ---
def run_ga(excel_path, Bp, Bm, BL, S_max, d_base, bits_per_chromosome):
    try:
        logger.info(f"Reading Excel file: {excel_path}")
        df = pd.read_excel(excel_path)

        # Validate required columns
        required_columns = [
            'Product Name', 'Price', 'Production_Cost_Per_Unit',
            'Marketing_Cost_Per_Unit', 'Logistics_Cost_Per_Unit',
            'Shelf_Space_Cost_Per_Unit', 'Age', 'Remaining_Products',
            'shelf_space', 'Expected_Demand'
        ]
        missing = [col for col in required_columns if col not in df.columns]
        if missing:
            raise ValueError(f"Missing required columns: {missing}")

        # Map DataFrame to GA parameters
        params_df = pd.DataFrame({
            'cp': df['Production_Cost_Per_Unit'],
            'cm': df['Marketing_Cost_Per_Unit'],
            'cl': df['Logistics_Cost_Per_Unit'],
            'cs': df['Shelf_Space_Cost_Per_Unit'],
            'age': df['Age'],
            's_old': df['Remaining_Products'],
            'D_e': df['Expected_Demand'],
            'S_i': df['shelf_space'],
            'pr': df['Price']
        })

        # GA Configuration
        pop_size = 50
        gens = 100
        cr = 0.7
        mr = 0.01
        age_max = params_df['age'].max()
        max_q = int(params_df['s_old'].max())

        # Prepare parameters
        params_df['pe'] = d_base * (params_df['age']/age_max) * (params_df['s_old']/S_max)
        params = params_df.to_dict('records')

        # Initialize population
        pop = [Chromosome(bits_per_chromosome, len(params)) for _ in range(pop_size)]
        best, best_f = None, -math.inf

        # GA Main loop
        for g in range(gens):
            # Repair & validate chromosomes
            for c in pop:
                c.repair(params, Bp, Bm, BL, S_max)
                q = c.decode()
                valid = check_constraints(q, params, Bp, Bm, BL, S_max)
                logger.debug(f"Generation {g}: Chrom {c.bitstring} valid: {valid}")

            # Evaluate fitness
            fits = []
            for c in pop:
                q = c.decode()
                fit, _, _ = fitness_and_penalties(q, params, d_base, age_max, S_max)
                fits.append(fit)

            # Track best solution
            idx = max(range(len(pop)), key=lambda i: fits[i])
            if fits[idx] > best_f:
                best, best_f = pop[idx].clone(), fits[idx]

            # Create new generation
            new_pop = [best.clone()]
            while len(new_pop) < pop_size:
                p1 = tournament_selection(pop, fits)
                p2 = tournament_selection(pop, fits)
                c1, c2 = one_point_crossover(p1, p2) if random.random() < cr else (p1.clone(), p2.clone())
                mutate(c1, mr)
                mutate(c2, mr)
                for c in (c1, c2):
                    c.repair(params, Bp, Bm, BL, S_max)
                    new_pop.append(c)
                    if len(new_pop) >= pop_size:
                        break
            pop = new_pop[:pop_size]

        # Final results calculation
        q = best.decode()
        total_profit, penalties, profits = fitness_and_penalties(q, params, d_base, age_max, S_max)

        # Build results structure
        products = []
        for i, row in df.iterrows():
            unit_cost = (row['Production_Cost_Per_Unit'] +
                         row['Marketing_Cost_Per_Unit'] +
                         row['Logistics_Cost_Per_Unit'] +
                         row['Shelf_Space_Cost_Per_Unit'])

            products.append({
                "name": row['Product Name'],
                "quantity": q[i],
                "price": row['Price'],
                "unit_cost": unit_cost,
                "profit_per_unit": row['Price'] - unit_cost,
                "total_profit": (row['Price'] - unit_cost) * q[i],
                "total_cost": unit_cost * q[i]
            })

        return {
            "total_profit": total_profit,
            "products": products
        }

    except Exception as e:
        logger.error(f"GA Error: {str(e)}")
        traceback.print_exc()
        raise

def main():
    try:
        parser = argparse.ArgumentParser(description="Run Genetic Algorithm for Fashion Optimization")
        parser.add_argument("file_path", help="Path to the Excel or CSV file")
        parser.add_argument("--bp", type=float, required=True, help="Production budget")
        parser.add_argument("--bm", type=float, required=True, help="Marketing budget")
        parser.add_argument("--bl", type=float, required=True, help="Logistics budget")
        parser.add_argument("--s_max", type=float, required=True, help="Shelf space")
        parser.add_argument("--d_base", type=float, required=True, help="Discount base")
        parser.add_argument("--chromosome_bits", type=int, required=True, help="Chromosome bits")

        args = parser.parse_args()
        logging.info(f"Arguments received: {vars(args)}")

        results = run_ga(
            args.file_path,
            args.bp,
            args.bm,
            args.bl,
            args.s_max,
            args.d_base,
            args.chromosome_bits
        )
        print(json.dumps(results))
    except Exception as e:
        logging.error(f"Error in main: {str(e)}")
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()