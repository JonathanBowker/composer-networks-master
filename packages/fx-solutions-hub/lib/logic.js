/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Track the trade of a currency from one trader to another
 * @param {fx.solutions.hub.Trade} trade - the trade to be processed
 * @transaction
 */
function tradeCurrency(trade) {

    // set the new owner of the currency
    trade.currency.owner = trade.newOwner;
    return getAssetRegistry('fx.solutions.hub.Currency')
        .then(function(assetRegistry) {

            // emit a notification that a trade has occurred
            var tradeNotification = getFactory().newEvent('fx.solutions.hub', 'TradeNotification');
            tradeNotification.currency = trade.currency;
            emit(tradeNotification);

            // persist the state of the currency
            return assetRegistry.update(trade.currency);
        });
}

/**
 * Remove all high volume currencies
 * @param {fx.solutions.hub.RemoveHighQuantityCurrencies} remove - the remove to be processed
 * @transaction
 */
function removeHighQuantityCurrencies(remove) {

    return getAssetRegistry('fx.solutions.hub.Currency')
        .then(function(assetRegistry) {
            return query('selectCurrenciesWithHighQuantity')
                .then(function(results) {

                    var promises = [];

                    for (var n = 0; n < results.length; n++) {
                        var trade = results[n];

                        // emit a notification that a trade was removed
                        var removeNotification = getFactory().newEvent('fx.solutions.hub', 'RemoveNotification');
                        removeNotification.currency = trade;
                        emit(removeNotification);

                        // remove the currency
                        promises.push(assetRegistry.remove(trade));
                    }

                    // we have to return all the promises
                    return Promise.all(promises);
                });
        });
}