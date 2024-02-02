import { createHash } from 'node:crypto'
import { config, roles } from './init.js'

const hash = createHash('sha256')
const salt = config.ns_prefix

export const pensionCredential = {
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    `${config.ns_prefix}/pensioncredential-schema/pensioncredential.json`
  ],
  "id": `${config.ns_prefix}/${new Date().getTime()}`,
  "type": [
    "VerifiableCredential",
    "PensionCertificate"
  ],
  "issuer": {
    "type": ["Profile"],
    "id": roles['issuer'].did,
    "name": roles['issuer'].name,
    "url": roles['issuer'].url,
    "url": roles['issuer'].image,
  },
  "issuanceDate": new Date().toISOString(),
  "expirationDate": new Date().toISOString(),
  "credentialSubject": {
    "pension": {
      "type": "Varhennettu kansaneläke",
      "startDate": "2024-02-01",
      "endDate": "2024-08-01",
      "status": "Väliaikainen"
    },
    "person": {
      "firstName": "Matti",
      "lastName": "Meikäläinen",
      "dateOfBirth": "1960-07-31"
    },
    "identityObject": {
      "hashed": true,
      "identityHash": `sha256$${hash.update('Matti Meikäläinen'+salt).digest('hex')}`,
      "identityType": "name",
      "salt": salt
    }
  }
}