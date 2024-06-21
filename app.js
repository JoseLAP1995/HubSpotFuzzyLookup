const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000; // Choose any port you prefer
const Fuse = require('fuse.js')

// Middleware to parse JSON bodies
app.use(express.json());

// Example route to handle POST requests
app.post('/data', async (req, res) => {
    // Access JSON data from the request body
    const data = req.body;
    const apikey = req.headers['hubspot-script-apikey'];
    const allCompanies = [];
    let url = "https://api.hubapi.com/crm/v3/objects/companies?limit=100&properties=name&properties=type&properties=hs_object_id&properties=domain&archived=false";
    let response;

    while(url !== null && url !== undefined && url !== ""){
        response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${apikey}`
            }
        });

        url = response?.data?.paging?.next?.link;

        const results = response.data.results

        results.map(result => {
            if(result.properties.type === "Publisher"){
                allCompanies.push({
                    name: result.properties.name,
                    type: result.properties.type,
                    hs_object_id: result.properties.hs_object_id,
                    domain: result.properties.domain,
                    nameDomain: `${result.properties.name} ${result.properties.domain}`
                })
            }
        })
    }
    const fuseOptions = {
        // isCaseSensitive: false,
        includeScore: true,
        shouldSort: true,
        // includeMatches: false,
        findAllMatches: true,
        // minMatchCharLength: 1,
        // location: 0,
        // threshold: 0.5,
        // distance: 100,
        // useExtendedSearch: false,
        // ignoreLocation: false,
        // ignoreFieldNorm: false,
        // fieldNormWeight: 1,
        keys: [
            "nameDomain"
        ]
    }
    const fuse = new Fuse(allCompanies, fuseOptions);

    const searchPattern = `${data.name} ${data.domain}`

    const fuzzyResults = fuse.search(searchPattern);

    const potentialDuplicates = [];

    fuzzyResults.forEach(result =>{
        potentialDuplicates.push({
            hubSpotURL: `https://app.hubspot.com/contacts/20613241/record/0-2/${result.item.hs_object_id}`,
            similarityPercentage: `${Number(Math.round(((1 - result.score)*100)+'e2')+'e-2')}%`,
        })
    })

    console.log(potentialDuplicates[0]);

    const payload = {
        properties: {
            potential_company_duplicates__fuzzy_lookup_: JSON.stringify(potentialDuplicates)
        }
    }

    const finalResponse = await axios.patch(`https://api.hubapi.com/crm/v3/objects/companies/${data.hs_object_id}`, payload, {
        headers: {
            'Authorization': `Bearer ${apikey}`
        }
    })

    res.sendStatus(finalResponse.status);
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});