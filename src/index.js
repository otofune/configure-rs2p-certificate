/**
    Copyright 2020 otofune <otofune@otofune.me>

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
 */

const fetch = require('node-fetch')
const fs = require('fs')
const crypto = require('crypto')
const path = require('path')

class CustomError extends Error {
    constructor(message) {
        super(message)
        this.name = this.constructor.name
    }
}
class GehirnRS2PlusAPIError extends CustomError {
    constructor(reason) {
        super()
        this.reason = reason
    }
}
class PreconditionError extends CustomError { }

const callGehirnRS2PlusAPI = (gehirn) => async (path, options = {}) => {
    const fetchOptions = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: gehirn.authorize,
            ...(options.headers || {})
        }
    }
    const response = await fetch(gehirn.root + path, fetchOptions)
    const body = await response.json()
    if (!response.ok) throw new GehirnRS2PlusAPIError(body)
    return body
}

const getContainers = ({ call } = {}) => () => call('/rs2p/v1/containers')
const getSites = ({ call } = {}) => (containerId) => call(`/rs2p/v1/containers/${containerId}/sites`)
const putSite = ({ call } = {}) => (containerId, siteId, data) => call(`/rs2p/v1/containers/${containerId}/sites/${siteId}`, { method: 'PUT', body: JSON.stringify(data) })

const findContainerByLabel = (containers, label) => containers.find(c => c.label === label)
const findSiteIdByHostname = (sites, hostname) => sites.find(s => s.hostname === hostname)

const updateCertificate = ({ getSites, putSite } = {}) => async (containerId, siteDomain, cert, key, intermediates) => {
    const sites = await getSites(containerId)
    const siteData = findSiteIdByHostname(sites, siteDomain)
    if (!siteData) throw new PreconditionError('no such site')
    // ドメインの所有権がないなど
    if (!siteData.enabled) throw new PreconditionError('site is disabled')
    const { id: siteId } = siteData
    const updated = await putSite(containerId, siteId, { ...siteData, tls: { cert, key, intermediates, root: '' } })
    return !!updated.enabled
}

const convertKeyToPKCS1 = (pkcs8rsaprivate) => {
    if ('createPrivateKey' in crypto) {
        const keyObject = crypto.createPrivateKey({
            format: 'pem',
            key: pkcs8rsaprivate,
        })
        return keyObject.export({ format: 'pem', type: 'pkcs1' })
    } else {
        // fallback
        const { status, stdout } = require('child_process').spawnSync('openssl', ['rsa'], { input: pkcs8rsaprivate  })
        if (status !== 0) {
            throw new PreconditionError(`convert key to PKCS#1 failed, openssl returns ${stdout}`)
        }
        return stdout
    }
}

const getCertbotCertificates = (certbotDirectory, siteDomain) => {
    const liveDirectory = path.join(certbotDirectory, `./live/${siteDomain}`)
    const readLiveFile = (name) => fs.readFileSync(path.join(liveDirectory, `./${name}`), { encoding: 'utf-8' })
    const BEGIN_CERTIFICATE = '-----BEGIN CERTIFICATE-----'
    const fullchain = readLiveFile('fullchain.pem')
    const key = convertKeyToPKCS1(readLiveFile('privkey.pem'))
    const [cert, ...intermediatesList] = fullchain.split(BEGIN_CERTIFICATE).slice(1).map(c => BEGIN_CERTIFICATE + c)
    const intermediates = intermediatesList.join('')
    return { key, cert, intermediates }
}

const getOptionsFromProcess = () => {
    const { CERTBOT_DIRECTORY, SITE_DOMAIN, GEHIRN_CONTAINER_LABEL, GEHIRN_CONTAINER_ID, GEHIRN_API_AUTHORIZE } = process.env

    // あとでまともなライブラリにする
    if (!CERTBOT_DIRECTORY) throw new PreconditionError('CERTBOT_DIRECTORY is required')
    if (!SITE_DOMAIN) throw new PreconditionError('SITE_DOMAIN is required')
    if (!GEHIRN_CONTAINER_LABEL && !GEHIRN_CONTAINER_ID) throw new PreconditionError('GEHIRN_CONTAINER_LABEL or GEHIRN_CONTAINER_ID is required.')
    if (!GEHIRN_API_AUTHORIZE) throw new PreconditionError('GEHIRN_API_AUTHORIZE is required')

    return {
        gehirn: {
            root: 'https://api.gis.gehirn.jp/',
            authorize: GEHIRN_API_AUTHORIZE.trim(),
            containerLabel: GEHIRN_CONTAINER_LABEL.trim(),
            containerId: GEHIRN_CONTAINER_ID.trim()
        },
        siteDomain: SITE_DOMAIN.trim(),
        certbot: {
            directory: CERTBOT_DIRECTORY.trim()
        }
    }
}

async function main() {
    const { gehirn, certbot, siteDomain } = getOptionsFromProcess()

    const call = callGehirnRS2PlusAPI(gehirn)
    const certificates = getCertbotCertificates(certbot.directory, siteDomain)

    const containerId = await (async () => {
        if (gehirn.containerId) return gehirn.containerId
        const containers = await getContainers({ call })()
        const { id: containerId = null } = findContainerByLabel(containers, gehirn.containerLabel) || {}
        if (!containerId) throw new PreconditionError('no such container')
        return containerId
    })()

    await updateCertificate({ putSite: putSite({ call }), getSites: getSites({ call }) })(containerId, siteDomain, certificates.cert, certificates.key, certificates.intermediates)
    process.exit(0)
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
