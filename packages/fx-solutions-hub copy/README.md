# Trade Network

> This Business Network illustrates currency trading.

This business network defines:

**Participant**
`Trader`

**Asset**
`Currency`

**Transaction(s)**
`Transaction`

**Event**
`TradeNotification `

To test this Business Network Definition in the **Test** tab:

Create two `Trader` participants:

```
{
  "$class": "fx.solutions.hub.Trader",
  "tradeId": "TRADER1",
  "firstName": "Jenny",
  "lastName": "Jones"
}
```

```
{
  "$class": "fx.solutions.hub.Trader",
  "tradeId": "TRADER2",
  "firstName": "Amy",
  "lastName": "Williams"
}
```

Create a `Currency` asset:

```
{
  "$class": "fx.solutions.hub.Currency",
  "tradingSymbol": "EUR",
  "description": "Euro",
  "mainExchange": "FXGO",
  "quantity": 72.297,
  "owner": "resource:fx.solutions.hub.Trader#TRADER1"
}
```

Submit a `Trade` transaction:

```
{
  "$class": "fx.solutions.hub.Trade",
  "currency": "resource:fx.solutions.hub.Currency#GBR",
  "newOwner": "resource:fx.solutions.hub.Trader#TRADER2"
}
```

After submitting this transaction, you should now see the transaction in the transaction registry. As a result, the owner of the currency `EUR` should now be owned `TRADER2` in the Asset Registry.

Congratulations!
