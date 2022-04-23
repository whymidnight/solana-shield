
let express = require('express');
const solanaWeb3 = require('@solana/web3.js');
const {Keypair} = require("@solana/web3.js")
const bs58 = require('bs58');
const wwwhisper = require('connect-wwwhisper');
const festch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const redis = require('redis');
const path = require('path');  require('dotenv').config({ path:path.join(__dirname, '.env') });

let REDIS_URL = process.env.REDIS_URL | 'redis://127.0.0.1:6379';

if (!process.env.SHIELDED_ACCOUNT_PRIVATE_KEY && !process.env.RECOVERY_ACCOUNT_ADDRESS) {
    console.log('Please set your ENV variables.');
    return;
}

if (!process.env.NETWORK) {
    console.log('Please select a network in your ENV variables.'); //needs mainnet-beta or devnet
}

const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl(process.env.NETWORK), 'confirmed');

let shieldedSecret = bs58.decode(process.env.SHIELDED_ACCOUNT_PRIVATE_KEY);
let recoveryAccount = process.env.RECOVERY_ACCOUNT_ADDRESS;

let shieldedAccount = Keypair.fromSecretKey(shieldedSecret);

const walletAddress = shieldedAccount.publicKey.toString();

console.log('Protecting account: %s', shieldedAccount.publicKey);
console.log('Recovery account: %s', recoveryAccount);

// Serve on PORT on Heroku and on localhost:5000 locally
let PORT = process.env.PORT || '5000';
const client = redis.createClient(REDIS_URL);
client.connect();

let app = express();

if (process.env.AUTH_ENABLED == 'true') {
    app.use(wwwhisper());
}

// Serve the two static assets
app.get('/', (req, res) => res.sendFile('index.html', { root: __dirname }));
app.get('/client.js', (req, res) => res.sendFile('client.js', { root: __dirname }));

app.get('/status', async (req, res) => {
    console.log('Getting Shield Status...');

        try {
            let shield_status = await client.get('shield_status');
            return res.send(shield_status);
        } catch (err) {
            console.log(err);
            res.sendStatus(500);
        }
});

app.post('/activate', async (req, res) => {
    console.log('Activating Shield...');
        try {
            await client.set('shield_status', 'activated');
            await client.publish('shield_status', 'activated');
        } catch (err) {
            console.log(err);
        }
});

app.post('/deactivate', async (req, res) => {
    console.log('Deactivating Shield...');
        try {
            await client.set('shield_status', 'deactivated');
            await client.publish('shield_status', 'deactivated');
        } catch (err) {
            console.log(err);
        }
});

client.set('shield_status', 'deactivated');
app.listen(PORT, () => console.log("Server started. Watching...%s", PORT));