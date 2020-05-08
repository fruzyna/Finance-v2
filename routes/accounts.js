var express = require('express')
var router = express.Router()

// connect to db
var mysql = require('mysql')
var config = require('../sql-config.json')
var connection = mysql.createPool(config)

var utils = require('./utils')


/**
 * Add Account
 */
router.get('/add', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    res.render('add-account')
  })
})

router.post('/add', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    let name = `"${req.body.name}"`
    connection.query(`SELECT id FROM accounts
                      WHERE user_id = ${user_id} and name = ${name}`, function (error, results, fields)
    {
      if (error)
      {
        console.log(error)
        res.render('add-account', { error_text: 'Unknown error occured'})
      }
      else if (results.length > 0)
      {
        res.render('add-account', { error_text: 'Account already exists'})
      }
      else
      {
        connection.query(`INSERT INTO accounts (user_id, name)
                          VALUES (${user_id}, ${name})`, function (error, results, fields)
        {
          if (error)
          {
            console.log(error)
            res.render('add-account', { error_text: 'Unknown error occured'})
          }
          else
          {
            res.redirect('/accounts')
          }
        })
      }
    })
  })
})

/**
 * Account Balances
 */
router.get('/', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    connection.query(`SELECT sum(t.amount) as raw, format(sum(t.amount), 2) as balance, a.name
                      FROM transactions as t
                      INNER JOIN accounts as a ON t.account_id = a.id
                      WHERE t.user_id = ${user_id}
                      GROUP BY account_id
                      UNION
                      SELECT sum(amount) as raw, format(sum(amount), 2) as balance, "Total" as name
                      FROM transactions
                      WHERE user_id = ${user_id}`, function (error, results, fields)
    {
      if (error)
      {
        res.send(error)
      }
      else if (results.length > 0)
      {
        res.render('balances', { title: 'Finance', accounts: results})
      }
      else
      {
        res.send("No accounts found")
      }
    })
  })
})

module.exports = router