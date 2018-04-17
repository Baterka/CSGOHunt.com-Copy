let axios = require('axios');
let fs = require('fs');
let speakeasy = require('speakeasy');

let secret = "TM72QL2MPOQZLZEL";
let api_key = "f937d313-e693-491f-ae29-c4258878fc5c";

let token = speakeasy.totp({
    secret: secret,
    encoding: 'base32'
});

let url = "https://bitskins.com/api/v1/get_all_item_prices/?api_key=" + api_key + "&code=" + token; //Full URL to source
let path = "./"; //Full path to prices.json file

function loadPrices() {
    console.log('Downloading prices from: \'' + url + '\'');
    axios.get(url)
        .then(function (response) {
            if (response.data.status === "success") {
                fs.writeFileSync(path + 'prices_raw.json', JSON.stringify(response.data.prices));
                let prices = response.data.prices;
                let processedPrices = {};
                let l = Object.keys(prices).length;
                for (let i = 0; i < l; i++) {
                    processedPrices[prices[i].market_hash_name] = (prices[i].price * 100).toFixed(0);
                }
                let json = JSON.stringify(processedPrices);
                fs.writeFileSync(path + 'prices.json', json);
                console.log('Prices saved to \'' + path + '\'');
            } else
                console.log('Error while downloading...');
        })
        .catch(function (error) {
            console.log(error);
        });
}

loadPrices();

//parsePrices();
function parsePrices() {
    let raw = fs.readFileSync(path + '/prices_raw.txt');
    let prices = JSON.parse(raw);
    let i;
    let l = Object.keys(prices.prices).length;
    let prices = {};
    for (i = 0; i < l; i++) {
        prices[prices.prices[i].market_hash_name] = prices.prices[i].price;
    }
    let json = JSON.stringify(prices);
    fs.writeFileSync(path + '/prices.txt', json);
    console.log('Prices saved to \'' + path + '\'');
}