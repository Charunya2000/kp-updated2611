/**
 * Environment configuration for usage-report API routes.
 *
 * Environment grouping rules:
 *  - psup / prod       → isolated; only queries their own environment
 *  - dev / uat / pp    → grouped as non-prod; queries dev + uat + pp
 *  - localhost         → defaults to dev + uat + pp
 */

export const ENV_DISPLAY_NAMES = { dev: 'DEV', pp: 'Preprod', uat: 'UAT', psup: 'PSUP', prod: 'Prod' };
export const NON_PROD_ENVS = ['dev', 'uat', 'pp'];
const PROD_ADJACENT_ENVS = ['psup', 'prod'];

/**
 * Returns the list of environments that should be queried for this request.
 *
 * @returns {string[]}
 */
export function getTargetEnvs() {
    const envName = process.env['envName'];

    // Prod-adjacent envs are isolated — each only queries itself
    if (PROD_ADJACENT_ENVS.includes(envName)) return [envName];

    // Non-prod deployments (dev/uat/pp) should query dev, uat and pp
    if (NON_PROD_ENVS.includes(envName)) return NON_PROD_ENVS;

    // Default/fallback: non-prod grouping
    return NON_PROD_ENVS;
}
