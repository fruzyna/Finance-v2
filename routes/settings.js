var express = require('express')
var router = express.Router()
var formidable = require('formidable')
var fs = require('fs')

// connect to db
var mysql = require('mysql')
var config = require('../sql-config.json')
var connection = mysql.createPool(config)

var utils = require('./utils')

router.get('/', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    connection.query(`SELECT right(session_key, 4) as session_key, last_accessed, description FROM sessions
                      WHERE user_id = ${user_id}`, function (error, results, fields)
    {
      if (error) 
      {
        console.log(error)
        res.render('settings', { title: 'Finance | Settings', error_text: req.query.error_text, keys: [] })
      }
      else
      {
        res.render('settings', { title: 'Finance | Settings', error_text: req.query.error_text, keys: results })
      }
    })
  })
})

router.get('/rmsession', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    connection.query(`DELETE FROM sessions
                      WHERE right(session_key, 4) = "${req.query.key}"
                        and user_id = ${user_id}`, function (error, results, fields)
    {
      if (error)
      {
        console.log(error)
        res.redirect(`/settings?error_text=Error deleting key ${req.query.key}`)
      }
      else
      {
        res.redirect('/settings')
      }
    })
  })
})

router.post('/chusername', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    let user = req.body.user
    let user_valid = utils.validate_username(user)
    if (user_valid != 'valid')
    {
      res.redirect(`/settings?error_text=${user_valid}`)
    }
    else
    {
      connection.query(`UPDATE users SET username = ${utils.sanitize(user)}
                        WHERE id = ${user_id} and password = password(${utils.sanitize(req.body.pass)})`, function (error, results, fields)
      {
        if (error)
        {
          console.log(error)
          res.redirect('/settings?error_text=Username already exists')
        }
        else
        {
          connection.query(`SELECT username FROM users
                            WHERE id = ${user_id} and username = ${utils.sanitize(user)}`, function (error, results, fields)
          {
            if (error) 
            {
              console.log(error)
              res.redirect('/settings?error_text=Error changing username')
            }
            else if (results.length == 0) 
            {
              console.log(error)
              res.redirect('/settings?error_text=Incorrect password')
            }
            else
            {
              res.redirect('/settings?error_text=Successfully updated username')
            }
          })
        }
      })
    }
  })
})

router.post('/chpassword', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    let pass = req.body.new1
    let pass_valid = utils.validate_password(pass, req.body.new2)
    if (pass_valid != 'valid')
    {
      res.redirect(`/settings?error_text=${pass_valid}`)
    }
    else
    {
      connection.query(`UPDATE users SET password = password(${utils.sanitize(pass)})
                        WHERE id = ${user_id} and password = password(${utils.sanitize(req.body.old)})`, function (error, results, fields)
      {
        if (error) 
        {
          console.log(error)
          res.redirect('/settings?error_text=Error changing password')
        }
        else
        {
          connection.query(`SELECT username FROM users
                            WHERE id = ${user_id} and password = password(${utils.sanitize(pass)})`, function (error, results, fields)
          {
            if (error) 
            {
              console.log(error)
              res.redirect('/settings?error_text=Error changing password')
            }
            else if (results.length == 0) 
            {
              res.redirect('/settings?error_text=Incorrect password')
            }
            else
            {
              res.redirect('/settings?error_text=Successfully updated password')
            }
          })
        }
      })
    }
  })
})

router.get('/logout', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    let session = req.cookies.session
    res.redirect(`/settings/rmsession?key=${session.substr(session.length - 4)}`)
  })
})

router.get('/export', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    connection.query(`SELECT t.id, t.title, t.location, date_format(t.date, "%Y-%m-%d") as date, t.amount, a.name, t.category, t.note, t.linked_transaction
                      FROM transactions as t
                      INNER JOIN accounts as a ON t.account_id = a.id
                      WHERE t.user_id = ${user_id}
                      ORDER BY t.date DESC`, function (error, results, fields)
    {
      if (error)
      {
        console.log(error)
        res.redirect(`/settings?error_text=Error exporting account`)
      }
      else if (results.length == 0)
      {
        res.redirect(`/settings?error_text=No transactions found`)
      }
      else
      {
        csvTxt = 'id,title,location,date,amount,account,category,note,linked_transaction\n'
        results.forEach(function (r, index)
        {
          csvTxt += `${r.id},${r.title},${r.location},${r.date},${r.amount},${r.name},${r.category},${r.note},${r.linked_transaction}\n`
        })
        res.set({'Content-Disposition': 'attachment; filename="finance-export.csv"'})
        res.send(csvTxt)
      }
    })
  })
})

router.post('/import', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    let error = ''
    new formidable.IncomingForm().parse(req)
      .on('file', function (name, file)
      {
        console.log('Got upload', file.path)
        fs.readFile(file.path, 'utf8', function (err, data)
        {
          if (err)
          {
            console.log(err)
            res.redirect(`/settings?error_text=Failed to read file`)
          }
          else if (!data.startsWith('id,title,location,date,amount,account,category,note,linked_transaction'))
          {
            console.log(data)
            res.redirect(`/settings?error_text=Invalid file uploaded`)
          }
          else
          {
            // remove all accounts and transactions
            connection.query(`DELETE FROM transactions
                              WHERE user_id = ${user_id}`, function (err, results, fields)
            {
              if (err)
              {
                console.log(err)
                res.redirect(`/settings?error_text=Error deleting existing transactions`)
              }
              else
              {
                connection.query(`DELETE FROM accounts
                                  WHERE user_id = ${user_id}`, function (err, results, fields)
                {
                  if (err)
                  {
                    console.log(err)
                    res.redirect(`/settings?error_text=Error deleting existing accounts`)
                  }
                  else
                  {
                    let accounts = []
                    let account_ids = {}
                    let transactions = {}
                    data.split('\n').forEach(function (line, index)
                    {
                      if (index != 0 && line.includes(','))
                      {
                        // parse row
                        let cells = line.split(',')
                        let account = cells[5]
                        transactions[cells[0]] = {
                          'title': cells[1],
                          'location': cells[2],
                          'date': cells[3],
                          'amount': cells[4],
                          'account': account,
                          'category': cells[6],
                          'note': cells[7],
                          'linked_transaction': cells[8]
                        }
                        
                        // add account if it is new
                        if (!accounts.includes(account))
                        {
                          accounts.push(account)
                        }
                      }
                    })

                    accounts.forEach(function (account, index)
                    {
                      connection.query(`INSERT INTO accounts (user_id, name)
                                        VALUES (${user_id}, "${account}")`, function (err, results, fields)
                      {
                        if (err)
                        {
                          console.log(err)
                          error = 'Error adding account'
                        }
                        else
                        {
                          account_ids[account] = results.insertId
                          if (Object.keys(account_ids).length == accounts.length)
                          {
                            // add each transaction
                            let id_map = {}
                            Object.keys(transactions).forEach(function (id, index)
                            {
                              let t = transactions[id]
                              connection.query(`INSERT INTO transactions (user_id, account_id, date, title, location, amount, category, note)
                                                VALUES (${user_id}, (SELECT id FROM accounts WHERE user_id = ${user_id} and name = "${t.account}"), 
                                                  "${t.date}", "${t.title}", "${t.location}", "${t.amount}", "${t.category}", "${t.note}")`, function (err, results, fields)
                              {
                                if (err)
                                {
                                  console.log(err)
                                  error = 'Error adding transaction'
                                }
                                else
                                {
                                  id_map[id] = results.insertId
                                  if (Object.keys(id_map).length == Object.keys(transactions).length)
                                  {
                                    Object.keys(transactions).forEach(function (id, index)
                                    {
                                      let lt = transactions[id].linked_transaction
                                      if (lt && lt != 'null' && Object.keys(id_map).includes(id) && Object.keys(id_map).includes(lt))
                                      {
                                        connection.query(`UPDATE transactions SET linked_transaction = ${id_map[lt]} WHERE id = ${id_map[id]}`, function (err, results, fields)
                                        {
                                          if (err)
                                          {
                                            console.log(err)
                                            error = 'Error linking transactions'
                                          }
                                        })
                                      }
                                    })
                                  }
                                }
                              })
                            })
                          }
                        }
                      })
                    })
                    res.redirect(`/history?error_text=${error}`)
                  }
                })
              }
            })
          }
        })
      })
      .on('aborted', function ()
      {
        console.error('Request aborted by the user')
        res.redirect(`/settings?error_text=Upload aborted`)
      })
      .on('error', function (err)
      {
        console.log(err)
        res.redirect(`/settings?error_text=Failed to upload file`)
      })
  })
})

router.get('/delete-account', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    connection.query(`SELECT username FROM users
                      WHERE id = ${user_id} and password = password(${utils.sanitize(req.query.password)})`, function (error, results, fields)
    {
      if (error)
      {
        console.log(error)
        res.redirect(`/settings?error_text=Error deleting account`)
      }
      else if (results.length > 0)
      {
        connection.query(`DELETE FROM transactions
                          WHERE user_id = ${user_id}`, function (error, results, fields)
        {
          if (error)
          {
            console.log(error)
            res.redirect(`/settings?error_text=Error deleting transactions`)
          }
          else
          {
            connection.query(`DELETE FROM accounts
                              WHERE user_id = ${user_id}`, function (error, results, fields)
            {
              if (error)
              {
                console.log(error)
                res.redirect(`/settings?error_text=Error deleting accounts`)
              }
              else
              {
                connection.query(`DELETE FROM sessions
                                  WHERE user_id = ${user_id}`, function (error, results, fields)
                {
                  if (error)
                  {
                    console.log(error)
                    res.redirect(`/settings?error_text=Error deleting sessions`)
                  }
                  else
                  {
                    connection.query(`DELETE FROM users
                                      WHERE id = ${user_id}`, function (error, results, fields)
                    {
                      if (error)
                      {
                        console.log(error)
                        res.redirect(`/settings?error_text=Error deleting account`)
                      }
                      else
                      {
                        res.redirect('/settings')
                      }
                    })
                  }
                })
              }
            })
          }
        })
      }
      else
      {
        res.redirect(`/settings?error_text=Invalid password`)
      }
    })
  })
})

module.exports = router