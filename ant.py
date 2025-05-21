import numpy as np
import pandas as pd
import random
import logging
import json
import argparse
import sys
import traceback
import os

# Configure logging
logging.basicConfig(
    filename='aco_debug.log',
    filemode='w',
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger()

def check_constraints(solution, Cp, Cm, Cl, S_unit, BP, Bm, BL, S_max, demand_max):
    """
    Check the constraints for a given solution:
    - Budget Constraints: production, marketing, logistics
    - Shelf Space Constraints
    - Demand Constraints
    """
    prod_cost = np.dot(Cp, solution)
    mark_cost = np.dot(Cm, solution)
    log_cost = np.dot(Cl, solution)
    shelf_used = np.dot(S_unit, solution)

    # Budget and shelf constraints
    if prod_cost > BP:
        return False
    if mark_cost > Bm:
        return False
    if log_cost > BL:
        return False
    if shelf_used > S_max:
        return False

    # Demand constraints
    if np.any(solution > demand_max):
        return False

    return True

def ant_colony_optimization(data, params):
    alpha = params.get('alpha', 1.0)
    beta = params.get('beta', 2.0)
    rho = params.get('evaporation_rate', 0.1)
    ants = params.get('n_ants', 10)
    iterations = params.get('n_iterations', 100)
    Q = params.get('pheromone_coefficient', 10.0)
    penalty_factor = params.get('penalty_factor', 1000.0)
    max_no_improvement = params.get('max_no_improvement', 5)  # Early stopping criteria

    price = data['Price'].values
    Cp = data['Production_Cost_Per_Unit'].values
    Cm = data['Marketing_Cost_Per_Unit'].values
    Cl = data['Logistics_Cost_Per_Unit'].values
    si = data['Shelf_Space_Cost_Per_Unit'].values
    Cs = data['Shelf_Space_Cost_Per_Unit'].values 
    age = data['Age'].values
    R = data['Remaining_Products'].values.astype(int)
    S_unit = data['shelf_space'].values
    
    # Handle different column names for demand
    if 'Expected_Demand' in data.columns:
        De = data['Expected_Demand'].values.astype(int)
    elif 'Average_Expected_Demand' in data.columns:
        De = data['Average_Expected_Demand'].values.astype(int)
    else:
        raise ValueError("No demand column found in data")

    demand_max = np.maximum(De - R, 0)

    BP = params.get('budget_production', 8000000.0)
    Bm = params.get('budget_marketing', 7000000.0)
    BL = params.get('budget_logistics', 6000000)
    S_max = params.get('shelf_capacity', 60000.0)
    TSC = params.get('Total_shelf_space_cost', 150000.0)
    d_base = params.get('d_base', 0.1)

    age_max = np.max(age)

    s_old_space = R
    storage_sum = np.sum(s_old_space)
    Pe = d_base * (age / age_max) * (s_old_space / storage_sum)
    unit_profit = price - (Cp + Cm + Cl + Cs)
    net_profit_unit = unit_profit * (1 - Pe)

    domains, heuristics, pheromone = [], [], []
    for i in range(len(price)):
        max_x = max(int(demand_max[i]), 0)
        domain = [0] if net_profit_unit[i] <= 0 or max_x <= 0 else list(range(0, max_x + 1))
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

    no_improvement_count = 0  # Initialize counter for early stopping

    for it in range(iterations):
        iteration_best_profit = -np.inf
        iteration_best_sol = None

        for a in range(ants):
            valid_solution_found = False
            attempts = 0
            max_attempts = 10

            while not valid_solution_found and attempts < max_attempts:
                solution = np.zeros(n_products, dtype=int)
                for i in range(n_products):
                    tau = pheromone[i]
                    eta = heuristics[i]
                    weights = (tau ** alpha) * (eta ** beta) if not np.all(eta == 0) else np.power(tau, alpha)
                    probs = weights / np.sum(weights) if np.sum(weights) > 0 else np.ones(len(domains[i])) / len(domains[i])
                    choice = np.random.choice(len(domains[i]), p=probs)
                    solution[i] = domains[i][choice]

                if check_constraints(solution, Cp, Cm, Cl, S_unit, BP, Bm, BL, S_max, demand_max):
                    valid_solution_found = True
                else:
                    attempts += 1

            if not valid_solution_found:
                logger.warning(f"Ant {a+1}: could not find a valid solution after {max_attempts} attempts")
                continue

            profit_per_product = net_profit_unit * solution
            total_profit = np.sum(profit_per_product)
            prod_cost = np.dot(Cp, solution)
            mark_cost = np.dot(Cm, solution)
            log_cost = np.dot(Cl, solution)
            shelf_used = np.dot(S_unit, solution)
            viol = max(0.0, prod_cost - BP) + max(0.0, mark_cost - Bm) + max(0.0, log_cost - BL) + max(0.0, shelf_used - S_max)
            penalized_profit = total_profit - penalty_factor * viol

            logger.debug(f"Ant {a+1}: Profit={total_profit:.2f}, Penalized={penalized_profit:.2f}, Violation={viol:.2f}")

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

        # Update pheromones
        for i in range(n_products):
            pheromone[i] *= (1 - rho)

        if iteration_best_sol:
            sol_vec, sol_profit, sol_viol, *_ = iteration_best_sol
            deposit_amount = Q * sol_profit / (1.0 + sol_viol)
            for i in range(n_products):
                idx = domains[i].index(sol_vec[i])
                pheromone[i][idx] += deposit_amount

        logger.info(f"Iteration {it+1}/{iterations}, best penalized profit = {iteration_best_profit:.2f}")

        # Early stopping check
        if iteration_best_profit <= best_profit:
            no_improvement_count += 1
        else:
            no_improvement_count = 0  # Reset count if improvement

        if no_improvement_count >= max_no_improvement:
            logger.info(f"Early stopping at iteration {it+1}, no improvement in {max_no_improvement} iterations.")
            break

    # Handle case where no valid solution was found
    if best_solution is None or not best_details:
        logger.error("No valid solution found in ant colony optimization")
        return {
            "error": "No valid solution found in ant colony optimization",
            "total_profit": 0.0,
            "products": []
        }
        
    best_q = best_solution
    # Ensure total_profit exists in best_details
    final_profit = best_details.get('total_profit', 0.0)
    if 'total_profit' not in best_details:
        # Calculate profit if not already in best_details
        unit_profit = price - (Cp + Cm + Cl + Cs)
        pe = d_base * (age / age_max) * ((s_old_space) / storage_sum)
        net_profit_unit = unit_profit * (1 - pe)
        final_profit = np.sum(net_profit_unit * best_q)
        best_details['total_profit'] = float(final_profit)
    
    revenue = price * best_q
    cost_total = (Cp + Cm + Cl + Cs) * best_q
    pe = d_base * (age / age_max) * ((s_old_space) / storage_sum)

    # Format results in the same structure as GA.py for consistency
    products_result = []
    for i in range(n_products):
        unit_cost = Cp[i] + Cm[i] + Cl[i] + Cs[i]
        profit_per_unit = price[i] - unit_cost
        total_profit = profit_per_unit * best_q[i]
        total_cost = unit_cost * best_q[i]
        
        product_name = data['Product Name'].iloc[i] if 'Product Name' in data.columns else f"Product {i+1}"
        
        products_result.append({
            "name": product_name,
            "quantity": int(best_q[i]),
            "price": float(price[i]),
            "unit_cost": float(unit_cost),
            "profit_per_unit": float(profit_per_unit),
            "total_profit": float(total_profit),
            "total_cost": float(total_cost)
        })

    result = {
        "total_profit": float(final_profit),
        "products": products_result
    }
    
    return result

def run_aco(excel_path, productionBudget, marketingBudget, logisticsBudget, storageSum, d_base):
    try:
        logger.info(f"Reading Excel file: {excel_path}")
        df = pd.read_excel(excel_path)

        # Validate required columns
        required_columns = [
            'Product Name', 'Price', 'Production_Cost_Per_Unit',
            'Marketing_Cost_Per_Unit', 'Logistics_Cost_Per_Unit',
            'Shelf_Space_Cost_Per_Unit', 'Age', 'Remaining_Products',
            'shelf_space'
        ]
        
        # Check for demand column (either Expected_Demand or Average_Expected_Demand)
        if 'Expected_Demand' in df.columns:
            demand_column = 'Expected_Demand'
        elif 'Average_Expected_Demand' in df.columns:
            demand_column = 'Average_Expected_Demand'
        else:
            raise ValueError("No demand column found in data")
            
        required_columns.append(demand_column)
        
        missing = [col for col in required_columns if col not in df.columns]
        if missing:
            raise ValueError(f"Missing required columns: {missing}")

        # Set up parameters for ACO
        params = {
            'alpha': 5.0,
            'beta': 10.0,
            'evaporation_rate': 0.5,
            'n_ants': 100,  # Reduced from 350 for faster execution
            'n_iterations': 50,  # Reduced from 100 for faster execution
            'pheromone_coefficient': 30.0,
            'penalty_factor': 1000.0,
            'd_base': d_base,
            'max_no_improvement': 5,  # Max number of iterations without improvement
            'budget_production': productionBudget,
            'budget_marketing': marketingBudget,
            'budget_logistics': logisticsBudget,
            'shelf_capacity': storageSum
        }
        
        # Run the optimization
        result = ant_colony_optimization(df, params)
        return result
        
    except Exception as e:
        logger.error(f"ACO Error: {str(e)}")
        traceback.print_exc()
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

        args = parser.parse_args()
        logging.info(f"Arguments received: {vars(args)}")

        results = run_aco(
            args.file_path,
            args.bp,
            args.bm,
            args.bl,
            args.s_max,
            args.d_base
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
