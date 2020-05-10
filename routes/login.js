var express = require('express')
var router = express.Router()

// connect to db
var mysql = require('mysql')
var config = require('../sql-config.json')
var connection = mysql.createPool(config)

var utils = require('./utils')

router.get('/', function(req, res, next)
{
  res.render('login', { error_text: req.query.error_text })
})

router.post('/', function(req, res, next)
{
  let user = utils.sanitize(req.body.user)
  connection.query(`SELECT id FROM users
                    WHERE username = ${user} and password = password(${utils.sanitize(req.body.pass)})`, function (error, results, fields)
  {
    if (error) 
    {
      console.log(error)
      res.redirect('/login?error_text=Login failure')
    }
    else if (results.length > 0)
    {
      let uid = utils.sanitize(results[0].id)
      let key = utils.generate_key()
      connection.query(`INSERT INTO sessions (session_key, user_id, last_accessed, description)
                        VALUES (${utils.sanitize(key)}, ${uid}, now(), ${utils.sanitize(req.headers['user-agent'])})`, function (error, results, fields)
      {
        if (error)
        {
          console.log(error)
          res.redirect('/login?error_text=Login failure')
        }
        else
        {
          res.cookie('session', key, { maxAge: 2592000000})
          res.redirect('/')
        }
      })
    }
    else
    {
      res.redirect('/login?error_text=Invalid username or password')
    }
  })
})

router.post('/create', function(req, res, next)
{
  let user = req.body.user
  let pass = req.body.pass1
  let user_valid = utils.validate_username(user)
  let pass_valid = utils.validate_password(pass, req.body.pass2)
  if (user_valid != 'valid')
  {
    res.redirect(`/login?error_text=${user_valid}`)
  }
  else if (pass_valid != 'valid')
  {
    res.redirect(`/login?error_text=${pass_valid}`)
  }
  else
  {
    connection.query(`INSERT INTO users (username, password)
                      VALUES (${utils.sanitize(user)}, password(${utils.sanitize(pass)}))`, function (error, results, fields)
    {
      if (error) 
      {
        console.log(error)
        res.redirect('/login?error_text=Account already exists')
      }
      else
      {
        connection.query(`SELECT id FROM users
                          WHERE username = ${utils.sanitize(user)} and password = password(${utils.sanitize(pass)})`, function (error, results, fields)
        {
          if (error) 
          {
            console.log(error)
            res.redirect('/login?error_text=Failed to create account')
          }
          else
          {
            let uid = results[0].id
            let key = utils.generate_key()
            connection.query(`INSERT INTO sessions (session_key, user_id, last_accessed, description)
                              VALUES (${utils.sanitize(key)}, ${utils.sanitize(uid)}, now(), ${utils.sanitize(req.headers['user-agent'])})`, function (error, results, fields)
            {
              if (error)
              {
                console.log(error)
                res.redirect('/login?error_text=Failed to login')
              }
              else
              {
                res.cookie('session', key, { maxAge: 2592000000})
                res.redirect('/')
              }
            })
          }
        })
      }
    })
  }
})

module.exports = router