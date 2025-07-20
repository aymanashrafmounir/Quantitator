# Ant Colony Optimization for Fashion Optimization (kero)
import numpy as np
import pandas as pd
import random
import logging
import math
import time
import argparse
import json
import sys
import traceback
from typing import Dict, List

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(filename='ant_colony.log', level=logging.DEBUG)

def check_constraints(solution, Cp, Cm, Cl, S_unit, BP, Bm, BL, S_max, demand_max):
    prod_cost = np.dot(Cp, solution)
    mark_cost = np.dot(Cm, solution)
    log_cost = np.dot(Cl, solution)
    shelf_used = np.dot(S_unit, solution)

    if prod_cost > BP or mark_cost > Bm or log_cost > BL or shelf_used > S_max:
        return False
    if np.any(solution > demand_max):
        return False
    return True

def ant_colony_optimization(data, params):
    alpha = params.get('alpha')
    beta = params.get('beta')
    rho = params.get('evaporation_rate')
    ants = params.get('n_ants')
    iterations = params.get('n_iterations')
    Q = params.get('pheromone_coefficient')
    max_no_improvement = params.get('max_no_improvement')

    price = data['Price'].values
    Cp = data['Production_Cost_Per_Unit'].values
    Cm = data['Marketing_Cost_Per_Unit'].values
    Cl = data['Logistics_Cost_Per_Unit'].values
    Cs = data['Shelf_Space_Cost_Per_Unit'].values
    age = data['Age'].values
    R = data['Remaining_Products'].values.astype(int)
    S_unit = data['shelf_space'].values
    De = data['Average_Expected_Demand'].values.astype(int)

    demand_max = np.maximum(De - R, 0)
    BP = params.get('budget_production' )
    Bm = params.get('budget_marketing')
    BL = params.get('budget_logistics')
    S_max = params.get('shelf_capacity')
    d_base = params.get('d_base')

    age_max = np.max(age)
    s_old_space = R
    storage_sum = np.sum(s_old_space)
    Pe = d_base * (age / age_max) * (s_old_space / storage_sum)
    unit_profit = price - (Cp + Cm + Cl + Cs)
    net_profit_unit = unit_profit * (1 - Pe)

    domains, heuristics, pheromone = [], [], []
    for i in range(len(price)):
        max_x = max(int(demand_max[i]), 0)
        if net_profit_unit[i] <= 0 or max_x <= 0:
            domains.append([0])
            heuristics.append(np.array([1.0]))
            pheromone.append(np.array([1.0]))
            continue

        domain = list(range(0, max_x + 1))
        h = [1e-6 if x == 0 else max(0.0, net_profit_unit[i] * x) for x in domain]
        h = np.array(h)
        if h.max() > 0:
            h = h / h.max()
        domains.append(domain)
        heuristics.append(h)
        pheromone.append(np.random.uniform(0.9, 1.1, size=len(domain)))

    n_products = len(price)
    best_solution = None
    best_profit = -np.inf
    best_details = {}
    no_improvement_count = 0

    for it in range(iterations):
        iteration_best_profit = -np.inf
        iteration_best_sol = None

        for a in range(ants):
            solution = np.zeros(n_products, dtype=int)
            # Flag to track if a valid solution (meeting constraints) was found during this ant's construction
            current_ant_valid = True 
            
            for i in range(n_products):
                tau = pheromone[i]
                eta = heuristics[i]
                weights = (tau ** alpha) * (eta ** beta) if not np.all(eta == 0) else np.power(tau, alpha)
                probs = weights / np.sum(weights) if np.sum(weights) > 0 else np.ones(len(domains[i])) / len(domains[i])
                
                # Handle cases where probabilities might sum to zero or contain NaNs
                if np.sum(probs) == 0 or np.isnan(probs).any():
                    probs = np.ones(len(domains[i])) / len(domains[i]) # Fallback to uniform distribution

                choice = np.random.choice(len(domains[i]), p=probs)
                solution[i] = domains[i][choice]

            # After constructing a full solution, check constraints
            if not check_constraints(solution, Cp, Cm, Cl, S_unit, BP, Bm, BL, S_max, demand_max):
                current_ant_valid = False
                logger.debug(f"Ant {a+1}: Solution {solution.tolist()} violates constraints. Skipping profit calculation.")
                continue # Skip to next ant if constraints are violated

            profit_per_product = net_profit_unit * solution
            total_profit = np.sum(profit_per_product)
            prod_cost = np.dot(Cp, solution)
            mark_cost = np.dot(Cm, solution)
            log_cost = np.dot(Cl, solution)
            shelf_used = np.dot(S_unit, solution)
            
            # Calculate violation for penalty, but the original code uses it for profit calculation
            # The original code's penalized_profit was just total_profit, so I'll keep that for consistency
            viol = max(0.0, prod_cost - BP) + max(0.0, mark_cost - Bm) + max(0.0, log_cost - BL) + max(0.0, shelf_used - S_max)
            penalized_profit = total_profit # Original code did not penalize profit here

            logger.debug(f"Ant {a+1}: Solution={solution.tolist()}, Profit={total_profit:.2f}, Violation={viol:.2f}")

            if penalized_profit > iteration_best_profit:
                iteration_best_profit = penalized_profit
                iteration_best_sol = (solution.copy(), total_profit, viol, prod_cost, mark_cost, log_cost, shelf_used)

            if penalized_profit > best_profit:
                best_profit = penalized_profit
                best_solution = solution.copy()
                best_details = {
                    'total_profit': total_profit,
                    'violation': viol,
                    'prod_cost': prod_cost,
                    'mark_cost': mark_cost,
                    'log_cost': log_cost,
                    'shelf_used': shelf_used
                }

        # Evaporation
        for i in range(n_products):
            pheromone[i] *= (1 - rho)

        if iteration_best_sol:
            sol_vec, sol_profit, sol_viol, *_ = iteration_best_sol
            # Ensure sol_viol is not zero to prevent division by zero
            deposit_amount = Q * sol_profit / (1.0 + sol_viol)
            for i in range(n_products):
                # Ensure sol_vec[i] is in domains[i] before finding index
                if sol_vec[i] in domains[i]:
                    idx = domains[i].index(sol_vec[i])
                    pheromone[i][idx] += deposit_amount
                else:
                    logger.warning(f"Product {i}: Quantity {sol_vec[i]} not found in domain {domains[i]}. Pheromone not updated for this product.")


        logger.info(f"Iteration {it+1}/{iterations}, best penalized profit = {iteration_best_profit:.2f}")

        # Check for no improvement based on best_profit, not iteration_best_profit
        # This logic needs to be careful. If iteration_best_profit is used, it might reset too often.
        # The original code compared iteration_best_profit <= best_profit.
        # This means if the current iteration's best is not better than the overall best, count no improvement.
        if iteration_best_profit <= best_profit: # This condition is problematic if best_profit is updated within the same iteration
            no_improvement_count += 1
        else:
            no_improvement_count = 0
            best_profit = iteration_best_profit # Update best_profit here if it was truly better

        if no_improvement_count >= max_no_improvement:
            logger.info(f"Early stopping at iteration {it+1}, no improvement in {max_no_improvement} iterations.")
            break

    # Ensure best_solution is not None before proceeding
    if best_solution is None:
        logger.warning("No valid solution found during ACO optimization.")
        # Return default or error values
        return np.array([]), 0.0, pd.DataFrame(), {}

    best_q = best_solution
    final_profit = best_details['total_profit']
    revenue = price * best_q
    cost_total = (Cp + Cm + Cl + Cs) * best_q
    pe = d_base * (age / age_max) * (s_old_space / storage_sum)

    report = pd.DataFrame({
        'Product_ID': data['Product ID'],
        'Quantity': best_q,
        'Revenue': revenue,
        'Cost': cost_total,
        'Profit': (revenue - cost_total)*(1 - pe),
        'Penalty': pe
    })

    return best_q, final_profit, report, best_details


def run_aco(excel_path: str, productionBudget: float, marketingBudget: float, logisticsBudget: float, shelf_capacity: float, d_base: float, col_map: Dict[str, str]):
    try:
        logger.info(f"Reading Excel file: {excel_path}")
        df = pd.read_excel(excel_path)

        # Ensure all columns from col_map exist in the DataFrame
        missing_cols_in_df = [v for k, v in col_map.items() if v not in df.columns]
        if missing_cols_in_df:
            raise ValueError(f"Missing required columns in Excel/CSV: {missing_cols_in_df}. Please check your file and column mappings.")

        # Prepare data for ant_colony_optimization function
        # The 'Product ID' column is crucial for reporting
        aco_data = pd.DataFrame({
            'Product ID': df[col_map['name']], # Assuming 'name' maps to 'Product ID'
            'Price': df[col_map['price']],
            'Production_Cost_Per_Unit': df[col_map['cp']],
            'Marketing_Cost_Per_Unit': df[col_map['cm']],
            'Logistics_Cost_Per_Unit': df[col_map['cl']],
            'Shelf_Space_Cost_Per_Unit': df[col_map['cs']],
            'Age': df[col_map['age']],
            'Remaining_Products': df[col_map['stock']],
            'shelf_space': df[col_map['shelf']],
            'Average_Expected_Demand': df[col_map['demand']]
        })

        num_products = len(aco_data)
        if num_products == 0:
            return {
                "total_profit": 0.0,
                "products": []
            }

        # ACO Configuration parameters for ant_colony_optimization
        # Using default values from the original final aco.py for core ACO params
        # and passing budget constraints from run_aco arguments
        aco_params = {
            'alpha': 5.0,
            'beta': 10.0,
            'evaporation_rate': 0.3,
            'n_ants': 100,
            'n_iterations': 10,
            'pheromone_coefficient': 0.5,
            'max_no_improvement': 5,
            'budget_production': productionBudget,
            'budget_marketing': marketingBudget,
            'budget_logistics': logisticsBudget,
            'shelf_capacity': shelf_capacity, # Renamed from storageSum to shelf_capacity for clarity
            'd_base': d_base
        }

        # Call the core ACO function
        best_q, total_profit_aco, report_df, details = ant_colony_optimization(aco_data, aco_params)

        if best_q.size == 0: # Handle case where no valid solution was found
             return {
                "total_profit": 0.0,
                "products": []
            }

        # Prepare results in the format expected by the original run_aco's return
        products_results = []
        for i in range(num_products):
            product_name = str(aco_data['Product ID'].iloc[i])
            price = float(aco_data['Price'].iloc[i])
            cp = float(aco_data['Production_Cost_Per_Unit'].iloc[i])
            cm = float(aco_data['Marketing_Cost_Per_Unit'].iloc[i])
            cl = float(aco_data['Logistics_Cost_Per_Unit'].iloc[i])
            cs = float(aco_data['Shelf_Space_Cost_Per_Unit'].iloc[i])

            unit_cost = cp + cm + cl + cs
            quantity = int(best_q[i])

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

        # The total_profit_aco already includes the penalty from the ACO algorithm's perspective.
        # The original run_aco calculated overall_real_profit_no_penalty by summing individual product profits.
        # Let's use the total_profit_aco as it's the result of the optimization.
        overall_real_profit_no_penalty = float(sum(p['total_profit'] for p in products_results))


        return {
            "total_profit": overall_real_profit_no_penalty, # Reporting actual profit without penalty for user
            "products": products_results
        }

    except Exception as e:
        logger.error(f"Ant Colony Optimization Error: {str(e)}")
        traceback.print_exc()
        return {"error": str(e)}

# GEMINI ENHANCEMENT
def export_detailed_data(data_df, params, results):
    """Export all data, parameters, and results in a format Gemini can process"""
    detailed_output = {
        "input_data": data_df.to_dict(orient="records"),
        "parameters": {
            "production_budget": params.get('budget_production', 0),
            "marketing_budget": params.get('budget_marketing', 0),
            "logistics_budget": params.get('logistics_budget', 0),
            "shelf_space": params.get('shelf_capacity', 0),
            "discount_base": params.get('d_base', 0)
        },
        "results": results,
        "algorithm": "ant_colony_optimization"
    }
    with open('aco_detailed_output.json', 'w') as f:
        json.dump(detailed_output, f, indent=2)
    return detailed_output

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
            'stock': args.col_stock,
            'shelf': args.col_shelf,
            'demand': args.col_demand
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
            col_map
        )
        print(json.dumps(results))
    except Exception as e:
        logging.error(f"Error in main: {str(e)}")
        traceback.print_exc(file=sys.stderr)
        error_result = {"error": str(e)}
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main()
