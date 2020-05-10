var express = require('express')
var router = express.Router()

// connect to db
var mysql = require('mysql')
var config = require('../sql-config.json')
var connection = mysql.createPool(config)

var utils = require('./utils')

router.get('/', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    connection.query(`SELECT a.name, ifnull(sum(t.amount),0) as raw, format(ifnull(sum(t.amount),0), 2) as balance
                      FROM accounts as a
                      LEFT OUTER JOIN transactions as t ON t.account_id = a.id
                      WHERE a.user_id = ${user_id}
                      GROUP BY a.name
                      UNION
                      SELECT "Total" as name, sum(amount) as raw, format(sum(amount), 2) as balance
                      FROM transactions
                      WHERE user_id = ${user_id}`, function (error, results, fields)
    {
      if (error)
      {
        res.send(error)
      }
      else if (results.length > 0)
      {
        let edit = ''
        if (req.query.edit !== undefined)
        {
          edit = req.query.edit
        }
        res.render('balances', { title: 'Finance | Accounts', accounts: results, edit:edit, error_text: req.query.error_text })
      }
      else
      {
        res.send("No accounts found")
      }
    })
  })
})

router.post('/rename', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    let oldName = utils.sanitize(req.body.oldname)
    let newName = utils.sanitize(req.body.newname)

    connection.query(`UPDATE accounts SET name = ${newName}
                      WHERE user_id = ${user_id} and name = ${oldName}`, function (error, results, fields)
    {
      if (error)
      {
        console.log(error)
        res.redirect('/accounts?error_text=Error renaming account')
      }
      else
      {
        connection.query(`SELECT id FROM accounts
                          WHERE user_id = ${user_id} and name = ${newName}`, function (error, results, fields)
        {
          if (error)
          {
            console.log(error)
            res.redirect('/accounts?error_text=Error renaming account')
          }
          else if (results.length > 0)
          {
            res.redirect('/accounts')
          }
          else
          {
            res.redirect('/accounts?error_text=Failed to rename account')
          }
        })
      }
    })
  })
})

router.post('/add', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    let name = utils.sanitize(req.body.name)

    connection.query(`SELECT id FROM accounts
                      WHERE user_id = ${user_id} and name = ${name}`, function (error, results, fields)
    {
      if (error)
      {
        console.log(error)
        res.redirect('/accounts?error_text=Error adding account')
      }
      else if (results.length > 0)
      {
        res.redirect('/accounts?error_text=Account already exists')
      }
      else
      {
        connection.query(`INSERT INTO accounts (user_id, name)
                          VALUES (${user_id}, ${name})`, function (error, results, fields)
        {
          if (error)
          {
            console.log(error)
            res.redirect('/accounts?error_text=Error adding account')
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

router.get('/delete', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    let name = utils.sanitize(req.query.name)

    connection.query(`DELETE FROM accounts
                      WHERE user_id = ${user_id} and name = ${name}`, function (error, results, fields)
    {
      if (error)
      {
        console.log(error)
        res.redirect('/accounts?error_text=Error deleting account')
      }
      else
      {
        connection.query(`SELECT id FROM accounts
                          WHERE user_id = ${user_id} and name = ${name}`, function (error, results, fields)
        {
          if (error)
          {
            console.log(error)
            res.redirect('/accounts?error_text=Error deleting account')
          }
          else if (results.length == 0)
          {
            res.redirect('/accounts')
          }
          else
          {
            res.redirect('/accounts?error_text=Failed to delete account')
          }
        })
      }
    })
  })
})

module.exports = router