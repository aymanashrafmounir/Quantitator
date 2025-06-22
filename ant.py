# Updated Test/ant.py
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
logging.basicConfig(filename='ant_colony.log', level=logging.DEBUG)

# --- ACO Classes ---
class Ant:
    def __init__(self, num_products: int, quantities: List[int] = None):
        self.num_products = num_products
        if quantities:
            self.quantities = quantities
        else:
            self.quantities = [0] * num_products # Initialize with zero quantities
        self.profit = 0.0

    def clone(self) -> 'Ant':
        return Ant(self.num_products, list(self.quantities))

    def __repr__(self):
        return f"Ant(quantities={self.quantities}, profit={self.profit:.2f})"

# --- ACO Optimization ---
def calculate_profit(quantities: List[int], params: List[Dict[str, float]], d_base: float, age_max: float, storage_sum: float) -> float:
    total_profit = 0.0
    for i, x in enumerate(quantities):
        p = params[i]
        total_revenue = p['pr'] * x
        cost_per_item = p['cp'] + p['cm'] + p['cl'] + p['cs']
        total_cost = cost_per_item * x

        # Ensure age_max and storage_sum are not zero to avoid division by zero
        pe_age_factor = (p['age'] / age_max) if age_max > 0 else 0
        pe_storage_factor = (p['s_old'] / storage_sum) if storage_sum > 0 else 0

        pe = d_base * pe_age_factor * pe_storage_factor
        item_profit_with_penalty = (total_revenue - total_cost) * (1 - pe)
        total_profit += item_profit_with_penalty
    return total_profit

def apply_constraints_and_repair(quantities: List[int], params: List[Dict[str, float]], Bp: float, Bm: float, BL: float, S_max: float) -> List[int]:
    """Applies constraints and repairs quantities to be feasible."""
    repaired_quantities = list(quantities) # Start with a copy

    # Repair Demand: Ensure quantity + stock_old does not exceed demand
    for i in range(len(repaired_quantities)):
        max_q = params[i]['D_e'] - params[i]['s_old']
        repaired_quantities[i] = min(repaired_quantities[i], max(0, int(max_q)))

    # Repair Budgets and Shelf Space: Iteratively reduce quantities if constraints are violated
    # Prioritize reducing products that contribute most to cost/shelf space for faster convergence

    while True:
        prod_cost = sum(params[i]['cp'] * repaired_quantities[i] for i in range(len(repaired_quantities)))
        market_cost = sum(params[i]['cm'] * repaired_quantities[i] for i in range(len(repaired_quantities)))
        log_cost = sum(params[i]['cl'] * repaired_quantities[i] for i in range(len(repaired_quantities)))
        shelf_used = sum(params[i]['S_i'] * (repaired_quantities[i] + params[i]['s_old']) for i in range(len(repaired_quantities)))

        violated = False
        if prod_cost > Bp:
            violated = True
        if market_cost > Bm:
            violated = True
        if log_cost > BL:
            violated = True
        if shelf_used > S_max:
            violated = True

        if not violated:
            break # All constraints met

        # Find product to reduce: one with the highest combined cost/shelf_space per unit
        idx_to_reduce = -1
        max_impact = -1.0

        for i in range(len(repaired_quantities)):
            if repaired_quantities[i] > 0:
                impact = (params[i]['cp'] + params[i]['cm'] + params[i]['cl'] + params[i]['S_i'])
                if impact > max_impact:
                    max_impact = impact
                    idx_to_reduce = i

        if idx_to_reduce != -1 and repaired_quantities[idx_to_reduce] > 0:
            repaired_quantities[idx_to_reduce] -= 1
        else:
            # Cannot repair further, perhaps due to 0 quantities or other irreducible constraints
            # This can happen if budgets are too restrictive for any production.
            # In a real scenario, this might mean no feasible solution or very small quantities.
            break

    # Ensure no negative quantities
    repaired_quantities = [max(0, q) for q in repaired_quantities]

    return repaired_quantities

def initialize_pheromones(num_products: int, initial_pheromone: float) -> List[float]:
    return [initial_pheromone] * num_products

def select_next_quantity(product_idx: int, pheromones: List[float], alpha: float, demand: float, stock: float, max_q_bits: int) -> int:
    """
    Selects a quantity for a single product based on pheromones.
    This is a simplified selection process for discrete quantities.
    """
    # Max possible quantity for a product, limited by demand and bit representation
    max_possible_q = int(demand - stock) # Max based on demand
    max_representable_q = (1 << max_q_bits) - 1 # Max based on bits

    # The effective max quantity for this step
    current_max_q = min(max_possible_q, max_representable_q)

    if current_max_q <= 0:
        return 0 # Cannot produce any more for this product

    probabilities = []
    # Explore quantities from 0 up to current_max_q
    for q_value in range(current_max_q + 1):
        # The attractiveness can be based on the pheromone for this product, and some heuristic.
        # For simplicity, we can use pheromones directly related to production possibility for the product.
        # A more granular pheromone per quantity value would be more precise but complex.
        attractiveness = pheromones[product_idx] ** alpha
        probabilities.append(attractiveness)

    total_prob = sum(probabilities)
    if total_prob == 0:
        return random.randint(0, current_max_q) # Fallback if no probabilities

    normalized_probs = [p / total_prob for p in probabilities]

    # Roulette wheel selection
    r = random.random()
    cumulative_prob = 0
    for q_value, prob in enumerate(normalized_probs):
        cumulative_prob += prob
        if r <= cumulative_prob:
            return q_value

    return current_max_q # Fallback in case of floating point inaccuracies


def update_pheromones(pheromones: List[float], ants: List[Ant], evaporation_rate: float, Q: float):
    # Evaporate
    pheromones[:] = [p * (1 - evaporation_rate) for p in pheromones]

    # Deposit
    # For simplicity, each ant deposits pheromone proportional to its profit,
    # distributed among the products it "chose" to produce.
    # A more advanced ACO would have pheromone trails on the "paths" (i.e., specific quantity choices).
    for ant in ants:
        if ant.profit > 0: # Only profitable ants deposit
            pheromone_to_deposit = Q / ant.profit # Q is a constant, higher profit -> less pheromone deposited *per unit of profit*
            # Typically, it's Q * profit / path_length or just Q * profit
            # Let's simplify: Q * ant.profit
            deposit_amount = Q * ant.profit

            # Deposit equally on all products chosen for simplicity, or based on product contribution
            for i, q_val in enumerate(ant.quantities):
                if q_val > 0: # Only deposit if the product was chosen
                    pheromones[i] += deposit_amount / ant.num_products # Distribute deposit across chosen products

    # Prevent pheromones from becoming too small or too large (optional but good for stability)
    min_pheromone = 0.01
    max_pheromone = 10.0
    pheromones[:] = [max(min_pheromone, min(max_pheromone, p)) for p in pheromones]


def run_aco(excel_path: str, productionBudget: float, marketingBudget: float, logisticsBudget: float, storageSum: float, d_base: float, col_map: Dict[str, str]):
    try:
        logger.info(f"Reading Excel file: {excel_path}")
        df = pd.read_excel(excel_path)

        # Map DataFrame to ACO parameters using the provided col_map
        # Ensure all columns from col_map exist in the DataFrame
        missing_cols_in_df = [v for k, v in col_map.items() if v not in df.columns]
        if missing_cols_in_df:
            raise ValueError(f"Missing required columns in Excel/CSV: {missing_cols_in_df}. Please check your file and column mappings.")

        params_df = pd.DataFrame({
            'cp': df[col_map['cp']],
            'cm': df[col_map['cm']],
            'cl': df[col_map['cl']],
            'cs': df[col_map['cs']],
            'age': df[col_map['age']],
            's_old': df[col_map['stock']], # Uses col_map['stock']
            'D_e': df[col_map['demand']],   # Uses col_map['demand']
            'S_i': df[col_map['shelf']],    # Uses col_map['shelf']
            'pr': df[col_map['price']]
        })

        num_products = len(params_df)
        if num_products == 0:
            return {
                "total_profit": 0.0,
                "products": []
            }

        # ACO Configuration
        num_ants = 50
        num_iterations = 100
        initial_pheromone = 0.1
        evaporation_rate = 0.05
        Q = 1.0 # Pheromone deposit factor (constant)
        alpha = 1.0 # Influence of pheromone (exponent)

        # Max value for quantities based on chromosome_bits in GA.
        # Since ACO doesn't use bits directly here, we need a reasonable max quantity.
        # We can derive it from the max demand or a fixed large number.
        # Let's assume a reasonable max quantity for each product, perhaps linked to max_representable_q from GA.
        # For simplicity, let's just pick a reasonable large number, or derive from max demand.
        # max_q_bits for ACO should be based on the largest possible quantity that might be needed.
        # If no chromosome_bits from frontend for ACO, we might need a default or derive from max demand.
        # For now, let's assume a max quantity based on the highest demand if that's reasonable.
        max_possible_demand_q = float(params_df['D_e'].max()) if not params_df.empty else 1000
        # Let's say, 15 bits can represent up to 32767, which is usually enough for quantity.
        max_q_for_selection = 32767 # A reasonable large number

        age_max = float(params_df['age'].max())
        storage_sum = float(params_df['s_old'].sum())

        # Prepare parameters for profit calculation
        params = params_df.to_dict('records')

        pheromones = initialize_pheromones(num_products, initial_pheromone)
        best_ant = None
        best_profit = -math.inf

        start_time = time.time() # Start time for progress tracking
        for iteration in range(num_iterations):
            ants: List[Ant] = []
            for _ in range(num_ants):
                current_quantities = [0] * num_products
                for product_idx in range(num_products):
                    # Select a quantity for each product
                    selected_q = select_next_quantity(
                        product_idx,
                        pheromones,
                        alpha,
                        params[product_idx]['D_e'],
                        params[product_idx]['s_old'],
                        int(math.log2(max_q_for_selection)) + 1 # Bits needed to represent max_q
                    )
                    current_quantities[product_idx] = selected_q

                # Apply constraints and repair the generated quantities
                final_quantities = apply_constraints_and_repair(
                    current_quantities, params, productionBudget, marketingBudget, logisticsBudget, storageSum
                )

                ant = Ant(num_products, final_quantities)
                ant.profit = calculate_profit(ant.quantities, params, d_base, age_max, storage_sum)
                ants.append(ant)

                if ant.profit > best_profit:
                    best_profit = ant.profit
                    best_ant = ant.clone()
                    logger.debug(f"Iteration {iteration}: New best profit = {best_profit:.2f}")

            update_pheromones(pheromones, ants, evaporation_rate, Q)

            # Progress Tracking and Estimation
            if (iteration + 1) % (num_iterations // 10 or 1) == 0 or (iteration + 1) == num_iterations:
                elapsed_time = time.time() - start_time
                progress_percentage = ((iteration + 1) / num_iterations) * 100
                remaining_time = (elapsed_time / (iteration + 1)) * (num_iterations - (iteration + 1))
                print(f"[PROGRESS] ACO: {progress_percentage:.1f}% completed, estimated {remaining_time:.1f}s remaining")


        if best_ant is None:
            # This means no feasible solution was found with positive profit
            return {
                "total_profit": 0.0,
                "products": []
            }


        # Final results calculation using the best_ant
        final_quantities = best_ant.quantities
        # Explicitly cast to float
        realProfit = float(calculate_profit(final_quantities, params, d_base, age_max, storage_sum))

        # Calculate actual profit without penalty for reporting to user
        products_results = []
        for i, row_idx in enumerate(df.index): # Iterate using DataFrame's index
            row = df.loc[row_idx] # Get the row data using original DataFrame

            # Retrieve values using col_map and explicitly cast to Python native types
            product_name = str(row[col_map['name']])
            price = float(row[col_map['price']])
            cp = float(row[col_map['cp']])
            cm = float(row[col_map['cm']])
            cl = float(row[col_map['cl']])
            cs = float(row[col_map['cs']])

            unit_cost = cp + cm + cl + cs
            # Explicitly cast to int
            quantity = int(final_quantities[i])

            # Calculate total profit and total cost for the product
            total_profit_product = (price - unit_cost) * quantity
            total_cost_product = unit_cost * quantity

            products_results.append({
                "name": product_name,
                "quantity": quantity,
                "price": price,
                "unit_cost": unit_cost,
                "profit_per_unit": price - unit_cost,
                "total_profit": total_profit_product,
                "total_cost": total_cost_product
            })

        # Calculate overall real profit (without penalty) for the best solution
        # Explicitly cast to float
        overall_real_profit_no_penalty = float(sum(p['total_profit'] for p in products_results))

        return {
            "total_profit": overall_real_profit_no_penalty, # Report actual profit without penalty
            "products": products_results
        }

    except Exception as e:
        logger.error(f"Ant Colony Optimization Error: {str(e)}")
        traceback.print_exc()
        # Return a structured error response
        return {"error": str(e)}

def main():
    try:
        parser = argparse.ArgumentParser(description="Run Ant Colony Optimization for Fashion Optimization")
        parser.add_argument("file_path", help="Path to the Excel or CSV file")
        parser.add_argument("--bp", type=float, required=True, help="Production budget")
        parser.add_argument("--bm", type=float, required=True, help="Marketing budget")
        parser.add_argument("--bl", type=float, required=True, help="Logistics budget")
        parser.add_argument("--s_max", type=float, required=True, help="Shelf space")
        parser.add_argument("--d_base", type=float, required=True, help="Discount base")

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

        # Create the column mapping dictionary
        col_map = {
            'name': args.col_name,
            'price': args.col_price,
            'cp': args.col_cp,
            'cm': args.col_cm,
            'cl': args.col_cl,
            'cs': args.col_shelf_cost,
            'age': args.col_age,
            'stock': args.col_stock,    # Changed from 's_old' to 'stock' to align with col_map key
            'shelf': args.col_shelf,    # Changed from 'S_i' to 'shelf' to align with col_map key
            'demand': args.col_demand   # Changed from 'D_e' to 'demand' to align with col_map key
        }

        # Validate that no 'null' strings were passed for required columns from Java
        for key, value in col_map.items():
            if value == "null" or value == "":
                raise ValueError(f"Column mapping for '{key}' is missing or invalid (received '{value}'). Please select all required columns in the UI.")


        results = run_aco(
            args.file_path,
            args.bp,
            args.bm,
            args.bl,
            args.s_max,
            args.d_base,
            col_map # Pass the column map
        )
        print(json.dumps(results))
    except Exception as e:
        logging.error(f"Error in main: {str(e)}")
        traceback.print_exc(file=sys.stderr)
        error_result = {"error": str(e)}
        print(json.dumps(error_result))
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
        "algorithm": "ant_colony_optimization"
    }
    with open('aco_detailed_output.json', 'w') as f:
        json.dump(detailed_output, f, indent=2)
    return detailed_output
if __name__ == "__main__":
    main()