# Updated Test/GA.py
import random
import pandas as pd
import math
import logging
import json
import argparse
import os
import traceback
import sys
import time # Import time module
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
        integerQuantity = []
        for i in range(self.num_products):
            segment = self.bitstring[i*self.bits_per_product:(i+1)*self.bits_per_product]
            integerQuantity.append(int(segment, 2))
        logger.debug(f"Decoded: {integerQuantity}")
        return integerQuantity

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

        def feasible(qs):
            return ( sum(params[i]['cp']*qs[i] for i in range(len(qs))) <= Bp
                     and sum(params[i]['cm']*qs[i] for i in range(len(qs))) <= Bm
                     and sum(params[i]['cl']*qs[i] for i in range(len(qs))) <= BL
                     and sum(params[i]['S_i']*(qs[i]+params[i]['s_old'])
                             for i in range(len(qs))) <= S_max )

        while not feasible(quantities):
            idx = max(range(len(quantities)),
                      key=lambda i: quantities[i] * (params[i]['cp']
                                                     + params[i]['cm']
                                                     + params[i]['cl']
                                                     + params[i]['S_i']))
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
def fitness_and_penalties(q: List[int], params: List[Dict[str, float]], d_base, age_max, storage_sum) -> Tuple[float, List[float], List[float]]:
    penalties, penalizedProfits = [], []
    total = 0.0
    for x, p in zip(q, params):
        totalRevenue = p['pr'] * x
        costPerItem = p['cp'] + p['cm'] + p['cl'] + p['cs']
        totalCost = costPerItem * x

        # Ensure age_max and storage_sum are not zero to avoid division by zero
        pe_age_factor = (p['age'] / age_max) if age_max > 0 else 0
        pe_storage_factor = (p['s_old'] / storage_sum) if storage_sum > 0 else 0

        pe = d_base * pe_age_factor * pe_storage_factor
        itemProfitWithPenalty = (totalRevenue - totalCost) * (1 - pe)
        penalties.append(pe)
        penalizedProfits.append(itemProfitWithPenalty)
        total += itemProfitWithPenalty
        logger.debug(f"fitness X_i {x} age = {p['age']}  Remaining Product = {p['s_old']} storage Sum = {storage_sum} Max Age = {age_max} total {total}")
    return total, penalties, penalizedProfits

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

#profit without penalties (real profit for the user)
def calculateExpectedProfit(q: List[int], params: List[Dict[str, float]]) -> float:
    return sum((params[i]['pr'] - (params[i]['cp'] + params[i]['cm'] + params[i]['cl'] + params[i]['cs'])) * q[i]
               for i in range(len(q)))

# --- GA Runner ---
def run_ga(excel_path, productionBudget, marketingBudget, logisticsBudget, storageSum, d_base, bits_per_chromosome, col_map):
    try:
        logger.info(f"Reading Excel file: {excel_path}")
        df = pd.read_excel(excel_path)

        # Ensure all columns from col_map exist in the DataFrame
        missing_cols_in_df = [v for k, v in col_map.items() if v not in df.columns]
        if missing_cols_in_df:
            raise ValueError(f"Missing required columns in Excel/CSV: {missing_cols_in_df}. Please check your file and column mappings.")


        # Map DataFrame to GA parameters
        params_df = pd.DataFrame({
            'cp': df[col_map['cp']],
            'cm': df[col_map['cm']],
            'cl': df[col_map['cl']],
            'cs': df[col_map['cs']],
            'age': df[col_map['age']],
            's_old': df[col_map['stock']], # Uses col_map['stock']
            'D_e': df[col_map['demand']],
            'S_i': df[col_map['shelf']],   # Uses col_map['shelf']
            'pr': df[col_map['price']]
        })

        # GA Configuration
        pop_size = 50
        gens = 100
        cr = 0.7
        mr = 0.01

        age_max = float(params_df['age'].max())
        storage_sum = float(params_df['s_old'].sum())

        # Prepare parameters
        params_df['pe'] = d_base * (params_df['age']/age_max) * (params_df['s_old']/storage_sum)
        params = params_df.to_dict('records')

        # Initialize population
        pop = [Chromosome(bits_per_chromosome, len(params)) for _ in range(pop_size)]
        best, best_f = None, -math.inf

        start_time = time.time() # Start time for progress tracking
        # GA Main loop
        for g in range(gens):
            # Repair & validate chromosomes
            for c in pop:
                c.repair(params, productionBudget, marketingBudget, logisticsBudget, storageSum)
                q = c.decode()
                valid = check_constraints(q, params, productionBudget, marketingBudget, logisticsBudget, storageSum)
                logger.debug(f"Generation {g}: Chrom {c.bitstring} valid: {valid}")

            # Evaluate fitness
            fits = []
            for c in pop:
                q = c.decode()
                fit, _, _ = fitness_and_penalties(q, params, d_base, age_max, storage_sum)
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
                    c.repair(params, productionBudget, marketingBudget, logisticsBudget, storageSum)
                    new_pop.append(c)
                    if len(new_pop) >= pop_size:
                        break
            pop = new_pop[:pop_size]

            # Progress Tracking and Estimation
            if (g + 1) % (gens // 10 or 1) == 0 or (g + 1) == gens: # Print every 10% or at least once
                elapsed_time = time.time() - start_time
                progress_percentage = ((g + 1) / gens) * 100
                remaining_time = (elapsed_time / (g + 1)) * (gens - (g + 1))
                print(f"[PROGRESS] GA: {progress_percentage:.1f}% completed, estimated {remaining_time:.1f}s remaining")


        # Final results calculation
        q = best.decode()
        realProfit = float(calculateExpectedProfit(q, params)) # Explicitly cast

        # Build results structure
        products = []
        for i, row_idx in enumerate(df.index): # Iterate using DataFrame's index
            row = df.loc[row_idx] # Get the row data using original DataFrame

            # Retrieve values using col_map for final output and explicitly cast to Python native types
            product_name = str(row[col_map['name']])
            price = float(row[col_map['price']])
            cp = float(row[col_map['cp']])
            cm = float(row[col_map['cm']])
            cl = float(row[col_map['cl']])
            cs = float(row[col_map['cs']])

            unit_cost = cp + cm + cl + cs
            quantity = int(q[i]) # Optimal quantity from GA, ensure int

            products.append({
                "name": product_name,
                "quantity": quantity,
                "price": price,
                "unit_cost": unit_cost,
                "profit_per_unit": price - unit_cost,
                "total_profit": (price - unit_cost) * quantity,
                "total_cost": unit_cost * quantity
            })

        return {
            "total_profit": realProfit,
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

        # Add column mapping arguments, matching those in SimulationRequest.java and script.js
        parser.add_argument("--col_name", type=str, required=True)
        parser.add_argument("--col_price", type=str, required=True)
        parser.add_argument("--col_cp", type=str, required=True)
        parser.add_argument("--col_cm", type=str, required=True)
        parser.add_argument("--col_cl", type=str, required=True)
        parser.add_argument("--col_shelf_cost", type=str, required=True)
        parser.add_argument("--col_age", type=str, required=True)
        parser.add_argument("--col_stock", type=str, required=True)
        parser.add_argument("--col_shelf", type=str, required=True)
        parser.add_argument("--col_demand", type=str, required=True)

        args = parser.parse_args()
        logging.info(f"Arguments received: {vars(args)}")

        col_map = {
            'name': args.col_name,
            'price': args.col_price,
            'cp': args.col_cp,
            'cm': args.col_cm,
            'cl': args.col_cl,
            'cs': args.col_shelf_cost,
            'age': args.col_age,
            'stock': args.col_stock,    # Uses col_map['stock']
            'shelf': args.col_shelf,    # Uses col_map['shelf']
            'demand': args.col_demand   # Uses col_map['demand']
        }

        # Validate that no 'null' strings were passed for required columns from Java
        for key, value in col_map.items():
            if value == "null" or value == "":
                raise ValueError(f"Column mapping for '{key}' is missing or invalid (received '{value}'). Please select all required columns in the UI.")


        results = run_ga(
            args.file_path,
            args.bp,
            args.bm,
            args.bl,
            args.s_max,
            args.d_base,
            args.chromosome_bits,
            col_map
        )

        print(json.dumps(results))
    except Exception as e:
        logging.error(f"Error in main: {str(e)}")
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

# GEMINI ENHANCEMENT
def export_detailed_data(data_df, params, results):
    """Export all data, parameters, and results in a format Gemini can process"""
    detailed_output = {
        "input_data": data_df.to_dict(orient="records"),
        "parameters": {
            "production_budget": params.get('budget_production', 0),
            "marketing_budget": params.get('budget_marketing', 0),
            "logistics_budget": params.get('budget_logistics', 0),
            "shelf_space": params.get('shelf_capacity', 0),
            "discount_base": params.get('d_base', 0)
        },
        "results": results,
        "algorithm": "genetic_algorithm"
    }
    with open('ga_detailed_output.json', 'w') as f:
        json.dump(detailed_output, f, indent=2)
    return detailed_output
if __name__ == "__main__":
    main()