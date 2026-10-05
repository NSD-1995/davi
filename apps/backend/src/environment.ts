import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

// Load local settings before modules read JWT/provider configuration.
// Existing process environment values retain precedence (for deployed services).
const localEnvironment=resolve(__dirname,'../.env');
if(existsSync(localEnvironment))loadEnvFile(localEnvironment);
