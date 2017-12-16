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

'use strict';

const AdminConnection = require('composer-admin').AdminConnection;
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const BusinessNetworkDefinition = require('composer-common').BusinessNetworkDefinition;
const IdCard = require('composer-common').IdCard;
const MemoryCardStore = require('composer-common').MemoryCardStore;
const path = require('path');

require('chai').should();

const namespace = 'fx.solutions.hub';

describe('Currency Trading', () => {
    // In-memory card store for testing so cards are not persisted to the file system
    const cardStore = new MemoryCardStore();
    let adminConnection;
    let businessNetworkConnection;

    before(() => {
        // Embedded connection used for local testing
        const connectionProfile = {
            name: 'embedded',
            type: 'embedded'
        };
        // Embedded connection does not need real credentials
        const credentials = {
            certificate: 'FAKE CERTIFICATE',
            privateKey: 'FAKE PRIVATE KEY'
        };

        // PeerAdmin identity used with the admin connection to deploy business networks
        const deployerMetadata = {
            version: 1,
            userName: 'PeerAdmin',
            roles: ['PeerAdmin', 'ChannelAdmin']
        };
        const deployerCard = new IdCard(deployerMetadata, connectionProfile);
        deployerCard.setCredentials(credentials);

        const deployerCardName = 'PeerAdmin';
        adminConnection = new AdminConnection({ cardStore: cardStore });

        return adminConnection.importCard(deployerCardName, deployerCard).then(() => {
            return adminConnection.connect(deployerCardName);
        });
    });

    beforeEach(() => {
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });

        const adminUserName = 'admin';
        let adminCardName;
        let businessNetworkDefinition;

        return BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..')).then(definition => {
            businessNetworkDefinition = definition;
            // Install the Composer runtime for the new business network
            return adminConnection.install(businessNetworkDefinition.getName());
        }).then(() => {
            // Start the business network and configure an network admin identity
            const startOptions = {
                networkAdmins: [{
                    userName: adminUserName,
                    enrollmentSecret: 'adminpw'
                }]
            };
            return adminConnection.start(businessNetworkDefinition, startOptions);
        }).then(adminCards => {
            // Import the network admin identity for us to use
            adminCardName = `${adminUserName}@${businessNetworkDefinition.getName()}`;
            return adminConnection.importCard(adminCardName, adminCards.get(adminUserName));
        }).then(() => {
            // Connect to the business network using the network admin identity
            return businessNetworkConnection.connect(adminCardName);
        });
    });

    describe('#tradeCurrency', () => {

        it('should be able to trade a currency', () => {
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // create the traders
            const dan = factory.newResource(namespace, 'Trader', 'dan@EURil.com');
            dan.firstName = 'Dan';
            dan.lastName = 'Selman';

            const simon = factory.newResource(namespace, 'Trader', 'simon@email.com');
            simon.firstName = 'Simon';
            simon.lastName = 'Stone';

            // create the currency
            const currency = factory.newResource(namespace, 'Currency', 'EUR');
            currency.description = 'Euro';
            currency.venue = 'FXGO';
            currency.quantity = 100;
            currency.owner = factory.newRelationship(namespace, 'Trader', dan.$identifier);

            // create the trade transaction
            const trade = factory.newTransaction(namespace, 'Trade');
            trade.newOwner = factory.newRelationship(namespace, 'Trader', simon.$identifier);
            trade.currency = factory.newRelationship(namespace, 'Currency', currency.$identifier);

            // the owner should of the currency should be dan
            currency.owner.$identifier.should.equal(dan.$identifier);

            // create the second currency
            const currency2 = factory.newResource(namespace, 'Currency', 'GBR');
            currency2.description = 'Pound Sterling';
            currency2.mainExchange = 'Currenex';
            currency2.quantity = 50;
            currency2.owner = factory.newRelationship(namespace, 'Trader', dan.$identifier);

            // register for events from the business network
            businessNetworkConnection.on('event', (event) => {
                console.log('Received event: ' + event.getFullyQualifiedIdentifier() + ' for currency ' + event.currency.getIdentifier());
            });

            // Get the asset registry.
            return businessNetworkConnection.getAssetRegistry(namespace + '.Currency')
                .then((assetRegistry) => {

                    // add the currencies to the asset registry.
                    return assetRegistry.addAll([currency, currency2])
                        .then(() => {
                            return businessNetworkConnection.getParticipantRegistry(namespace + '.Trader');
                        })
                        .then((participantRegistry) => {
                            // add the traders
                            return participantRegistry.addAll([dan, simon]);
                        })
                        .then(() => {
                            // submit the transaction
                            return businessNetworkConnection.submitTransaction(trade);
                        })
                        .then(() => {
                            return businessNetworkConnection.getAssetRegistry(namespace + '.Currency');
                        })
                        .then((assetRegistry) => {
                            // re-get the currency
                            return assetRegistry.get(currency.$identifier);
                        })
                        .then((newCurrency) => {
                            // the owner of the currency should now be simon
                            newCurrency.owner.$identifier.should.equal(simon.$identifier);
                        })
                        .then(() => {
                            // use a query
                            return businessNetworkConnection.query('selectCurrenciesByExchange', { exchange: 'Euronext' });
                        })
                        .then((results) => {
                            // check results
                            results.length.should.equal(1);
                            results[0].getIdentifier().should.equal('EUR');
                        })
                        .then(() => {
                            // use another query
                            return businessNetworkConnection.query('selectCurrenciesByOwner', { owner: 'resource:' + simon.getFullyQualifiedIdentifier() });
                        })
                        .then((results) => {
                            //  check results
                            results.length.should.equal(1);
                            results[0].getIdentifier().should.equal('EUR');
                        })
                        .then(() => {
                            // submit the remove transaction
                            const remove = factory.newTransaction(namespace, 'RemoveHighQuantityCurrencies');
                            return businessNetworkConnection.submitTransaction(remove);
                        })
                        .then(() => {
                            // use a query
                            return businessNetworkConnection.query('selectCurrencies');
                        })
                        .then((results) => {
                            // check results, should only have 1 currency left
                            results.length.should.equal(1);
                            results[0].getIdentifier().should.equal('GBR');
                        });
                });
        });
    });
});