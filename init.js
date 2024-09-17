import sqlite3 from 'sqlite3'
import config from './config.json' with {'type': 'json'}
import auth from './auth.js'

const issuerName = 'Kela'
const issuerImage = 'https://www.kela.fi/documents/20124/410402/logo-kela-rgb.png/50cdb366-b094-027e-2ac2-0439af6dc529?t=1643974848905'
const issuerUrl = 'https://kela.fi'
const issuerDidWebDomain = 'kela.fi'
// const verifierName = 'HSL'
// const verifierUrl = 'https://hsl.fi'
// const verifierImage = 'https://cdn-assets-cloud.frontify.com/s3/frontify-cloud-files-us/eyJwYXRoIjoiZnJvbnRpZnlcL2FjY291bnRzXC8yZFwvMTkyOTA4XC9wcm9qZWN0c1wvMjQ5NjY1XC9hc3NldHNcL2UzXC80NTY4ODQ2XC9lMjY2Zjg2NTU1Y2VjMGExZGM4ZmVkNDRiODdiMTNjNi0xNTk1NDI5MTAxLnN2ZyJ9:frontify:B-Us_1Aj3DJ5FKHvjZX1S0UOpg5wCFDIv4CNfy6rXQY?width=2400'

// override config file with environment variables
for (const param in config) {
    if (process.env[param] !== undefined) {
        config[param] = process.env[param]
    }
}

const apiHeaders = {
  'Accept': 'application/json',
  'Content-Type': 'application/json'
}
authenticate()
const db = await openDB()
const roles = await initRoles()
export { config, db, roles, apiHeaders }


async function authenticate() {
    const json = await auth()
    apiHeaders.Authorization = `Bearer ${json.access_token}`
    setTimeout(authenticate, json.refresh_expires_in * 1000) // no refresh but reauthentication...
}


function openDB() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(config.db_file, (err) => {
            if (err) reject(err.message)
            // console.log(`Connected to the database '${config.db_file}'.`)
            const create = `CREATE TABLE IF NOT EXISTS organizations (
                id INTEGER PRIMARY KEY,
                name varchar(50),
                role varchar(20),
                key varchar(2048),
                did VARCHAR(500),
                url VARCHAR(500),
                image VARCHAR(500)
            );`
            db.run(create, (err) => {
                if (err) reject(err.message)
                resolve(db)
            })
        })
    })
}

function initRoles() {
    return new Promise((resolve, reject) => {
        const selectOrganizations = "SELECT id, name, role, key, did, url, image FROM organizations;"
        const roles = {}
        db.all(selectOrganizations, [], async (err, rows) => {
            if (err) throw err;
            rows.forEach((row) => {
                roles[row.role] = row
            })
            if (roles.issuer?.did) {
                resolve(roles)
                return
            }
            if (!roles.issuer) {
                const headers = apiHeaders
                const body = JSON.stringify({
                    "key": {
                        "backend": "jwk",
                        "keyType": "secp256k1"
                    },
                    "did": {
                        "method": "jwk"
                        // "method": "web",
                        // "config": {
                        //     "domain": issuerDidWebDomain
                        // }
                    }
                })
                const resp = await fetch(`${config.issuer_api}/onboard/issuer`, { method: "POST", headers, body } )
                // console.log(`${config.issuer_api}/onboard/issuer`, { method: "POST", headers, body } )
                const json = await resp.json()
                const org = {
                    name: issuerName,
                    role: 'issuer',
                    key: JSON.stringify(json.issuerKey),
                    did: json.issuerDid,
                    url: issuerUrl,
                    image: issuerImage,
                }
                roles.issuer = await createOrganization(org)
            }
            resolve(roles)
        })
    })
}

function createOrganization(org) {
    const insertOrganization = db.prepare("REPLACE INTO organizations (name, role, key, did, url, image) VALUES (?, ?, ?, ?, ?, ?);")
    return new Promise((resolve, reject) => {
        const values = [
            org.name,
            org.role,
            org.key,
            org.did,
            org.url,
            org.image
        ]
        insertOrganization.run(values, function(err) {
            if (err) {
                reject(err)
                return
            }
            org.id = this.lastID
            resolve(org)
        })
    })
}