var express = require('express');
var router = express.Router();

// connect to db
var mysql = require('mysql');
var config = require('../sql-config.json')
var connection = mysql.createPool(config);

function process_date(date)
{
  date = date.trim().toLowerCase()
  if (date == '' || date == 'today')
  {
    return 'now()'
  }
  else if (date == 'yesterday')
  {
    return 'subdate(now(), 1)'
  }
  else if (date == 'tomorrow')
  {
    return 'adddate(now(), 1)'
  }
  return `"${date}"`
}

function generate_key()
{
  str = ''
  while (str.length < 32)
  {
    str += Math.random().toString(36).substr(2)
  }
  return str.substr(0, 32)
}

/**
 * Homepage
 */
router.get('/', function(req, res, next)
{
  if (req.cookies.session === undefined)  res.redirect('/login');
  else
  {
    session = `"${req.cookies.session}"`
    connection.query(`(SELECT date_format(t.date, "%Y-%m-%d") as date, t.amount as raw, format(t.amount, 2) as amount, "" as name
                      FROM transactions as t INNER JOIN sessions as s ON s.session_key = ${session}
                      WHERE t.user_id = s.user_id and t.date >= SUBDATE(now(), 31))
                      UNION
                      (SELECT now() as date, sum(t.amount) as raw, format(sum(t.amount), 2) as amount, u.username as name
                      FROM transactions as t INNER JOIN sessions as s ON s.session_key = ${session}
                      INNER JOIN users as u ON u.id = s.user_id WHERE t.user_id = s.user_id) ORDER BY date`, 
                      function (error, results, fields)
    {
      if      (error)               res.send(error);
      else if (results.length > 0)  res.render('index', { name: results[results.length-1].name, total: results[results.length-1].amount, totals: results });
      else                          res.redirect('/add');
    });
  }
});

/**
 * Login
 */
router.get('/login', function(req, res, next)
{
  res.render('login', { error_text: '' });
});

router.post('/login', function(req, res, next)
{
  user = req.body.user
  connection.query(`SELECT id FROM users WHERE username = "${user}"
                    and password = password("${req.body.pass}")`, function (error, results, fields)
  {
    if (error) 
    {
      console.log(error);
      res.render('login', { error_text: 'Login failure' });
    }
    else if (results.length > 0)
    {
      uid = results[0].id
      key = generate_key()
      connection.query(`INSERT INTO sessions (session_key, user_id)
                        VALUES ("${key}", "${uid}")`, function (error, results, fields)
      {
        if (error)
        {
          console.log(error)
          res.render('login', { error_text: 'Login failure' });
        }
        else
        {
          res.cookie('session', key, { maxAge: 2592000000});
          res.redirect('/');
        }
      })
    }
    else res.render('login', { error_text: 'Invalid username or password' });
  });
});

/**
 * Settings
 */
router.get('/settings', function(req, res, next)
{
  res.render('settings', { error_text: '' });
});

router.post('/password', function(req, res, next)
{
  if (req.body.new1 == req.body.new2)
  {
    connection.query(`UPDATE users, sessions SET password = password("${req.body.new1}") WHERE session_key = "${req.cookies.session}"
                      and id = user_id and password = password("${req.body.old}")`, function (error, results, fields)
    {
      if (error) 
      {
        console.log(error)
        res.render('settings', { error_text: 'Something went wrong' });
      }
      else
      {
        connection.query(`SELECT username FROM users INNER JOIN sessions ON session_key = "${req.cookies.session}"
                          WHERE id = user_id and password = password("${req.body.new1}")`, function (error, results, fields)
        {
          if (error) 
          {
            console.log(error)
            res.render('settings', { error_text: 'Something went wrong' });
          }
          else if (results.length > 0)
          {
            res.render('settings', { error_text: 'Successfully updated password' });
          }
          else
          {
            res.render('settings', { error_text: 'Incorrect password' });
          }
        });
      }
    });
  }
  else
  {
    res.render('settings', { error_text: 'Passwords do not match' });
  }
});

router.post('/logout', function(req, res, next)
{
  res.cookie('session', '', { maxAge: 0});
  res.redirect('/');
});

/**
 * Delete Entry
 */
router.get('/delete', function(req, res, next)
{
  connection.query(`DELETE FROM transactions WHERE id = "${req.query.id}"`, function (error, results, fields)
  {
    if (error)  res.send(`Error deleting entry ${req.query.id}`);
    else        res.redirect('/history');
  });
});

/**
 * Add Entry
 */
router.get('/add', function(req, res, next)
{
  session = `"${req.cookies.session}"`;
  connection.query(`SELECT DISTINCT t.location FROM transactions as t
                    INNER JOIN sessions as s ON s.session_key = ${session}
                    WHERE t.user_id = s.user_id`, function (error, locations, fields)
  {
    if (error || locations.length <= 0) locations = {};

    connection.query(`SELECT DISTINCT a.name
                      FROM transactions as t INNER JOIN accounts as a ON account_id = a.id
                      INNER JOIN sessions as s ON s.session_key = ${session}
                      WHERE t.user_id = s.user_id`, function (error, accounts, fields)
    {
      if (error || accounts.length <= 0) accounts = {};

      connection.query(`SELECT DISTINCT t.category FROM transactions as t
                        INNER JOIN sessions as s ON s.session_key = ${session}
                        WHERE t.user_id = s.user_id`, function (error, categories, fields)
      {
        if (error || categories.length <= 0) categories = {};

        res.render('add', { title: 'Finance', locations: locations, accounts: accounts, categories: categories });
      });
    });
  });
});

router.post('/add', function(req, res, next)
{
  date        = process_date(req.body.date);
  session     = `"${req.cookies.session}"`;
  account     = `"${req.body.account}"`;
  transfer    = `"${req.body.transfer}"`;
  title       = `"${req.body.title}"`;
  location    = `"${req.body.location}"`;
  amount      = `"${req.body.amount}"`;
  category    = `"${req.body.category}"`;
  note        = `"${req.body.note}"`;
  keep        = req.body.keep;
  
  connection.query(`INSERT INTO transactions (user_id, account_id, date, title, location, amount, category, note)
                    SELECT s.user_id, a.id, ${date}, ${title}, ${location}, ${amount}, ${category}, ${note}
                    FROM accounts as a INNER JOIN sessions as s ON s.session_key = ${session}
                    WHERE a.name = ${account} and a.user_id = s.user_id`, function (error, results, fields)
  {
    if (error)  res.send(error);
    else
    {
      id = results.insertId;
      if (req.body.transfer !== undefined && req.body.transfer != "")
      {
        amount = `"-${req.body.amount}"`;
        connection.query(`INSERT INTO transactions (user_id, account_id, date, title, location, amount, category, note, linked_transaction)
                          SELECT s.user_id, a.id, ${date}, ${title}, ${location}, ${amount}, ${category}, ${note}, max(t.id)
                          FROM accounts as a, transactions as t INNER JOIN sessions as s ON s.session_key = ${session}
                          WHERE a.name = ${transfer} and t.user_id = s.user_id and a.user_id = s.user_id`, function (error, results, fields)
        {
          if (error)  res.send(error);
          else
          {
            connection.query(`UPDATE transactions SET linked_transaction = 
                              (SELECT max(t.id) FROM transactions as t INNER JOIN sessions as s ON s.session_key = ${session}
                              WHERE s.session_key = ${session} and t.user_id = s.user_id)
                              WHERE id = ${id}`, function (error, results, fields)
            {
              if (error)      res.send(error);
              else if (!keep) res.redirect('/history');
              else            res.redirect('/add');
            });
          }
        });
      }
      else if (!keep) res.redirect('/history');
      else            res.redirect('/add');
    }
  });
});

/**
 * Add Account
 */
router.get('/add-account', function(req, res, next)
{
  res.render('add-account');
});

router.post('/add-account', function(req, res, next)
{
  session = `"${req.cookies.session}"`;
  name    = `"${req.body.name}"`;

  connection.query(`SELECT a.id FROM accounts as a
                    INNER JOIN sessions as s ON s.session_key = ${session}
                    WHERE a.user_id = s.user_id and a.name = ${name}`, function (error, results, fields)
  {
    if      (error)               res.render('add-account', { error_text: 'Unknown error occured'});
    else if (results.length > 0)  res.render('add-account', { error_text: 'Account already exists'});
    else
    {
      connection.query(`INSERT INTO accounts (user_id, name)
                        (SELECT user_id, ${name} FROM sessions WHERE session_key = ${session})`, function (error, results, fields)
      {
        if (error)  res.render('add-account', { error_text: 'Unknown error occured'});
        else        res.redirect('/accounts');
      });
    }
  });
});

/**
 * Account Balances
 */
router.get('/accounts', function(req, res, next)
{
  session = `"${req.cookies.session}"`;
  connection.query(`SELECT sum(amount) as raw, format(sum(amount), 2) as balance, name
                    FROM transactions as t
                    INNER JOIN accounts as a ON t.account_id = a.id
                    INNER JOIN sessions as s ON s.session_key = ${session}
                    WHERE t.user_id = s.user_id
                    GROUP BY account_id
                    UNION
                    SELECT sum(t.amount) as raw, format(sum(t.amount), 2) as balance, "Total" as name
                    FROM transactions as t
                    INNER JOIN sessions as s ON s.session_key = ${session}
                    WHERE t.user_id = s.user_id`, function (error, results, fields)
  {
    if      (error)               res.send(error);
    else if (results.length > 0)  res.render('balances', { title: 'Finance', accounts: results});
    else                          res.send("No accounts found");
  });
});

/**
 * Transaction History
 */
router.get('/history', function(req, res, next)
{
  limit = 10;
  if (req.query.limit !== undefined)  limit = req.query.limit;

  title = req.query.title;
  if (title === undefined || title == '') title = '';
  else                                    title = `AND t.title LIKE "%${title}%"`;

  location = req.query.location;
  if (location === undefined || location == '') location = '';
  else                                          location = `AND t.location = "${location}"`;

  account = req.query.account;
  if (account === undefined || account == '') account = '';
  else                                        account = `AND a.name = "${account}"`;

  before = req.query.before;
  if (before === undefined || before == '') before = '';
  else                                      before = `AND datediff(t.date, ${process_date(before)}) < 0`;

  after = req.query.after;
  if (after === undefined || after == '') after = '';
  else                                    after = `AND datediff(t.date, ${process_date(after)}) > 0`;

  category = req.query.category;
  if (category === undefined || category == '') category = '';
  else                                          category = `AND t.category = "${category}"`;

  note = req.query.note;
  if (note === undefined || note == '') note = '';
  else                                  note = `AND t.note = "${note}"`;

  session = `"${req.cookies.session}"`
  connection.query(`(SELECT t.id, title, location, date_format(date, "%Y-%m-%d") as date, amount as raw, format(amount, 2) as amount, a.name, category, note, "Edit" as edtext, "Delete" as deltext
                    FROM transactions as t INNER JOIN accounts as a ON t.account_id = a.id INNER JOIN sessions as s ON s.session_key = ${session}
                    WHERE t.user_id = s.user_id ${title} ${location} ${account} ${before} ${after} ${category} ${note}
                    ORDER BY t.date DESC LIMIT ${limit})
                    UNION
                    (SELECT "" as id, "Total" as title, "" as location, "" as date, sum(s.amount) as raw, format(sum(s.amount), 2) as amount, "" as name, "" as category, "" as note, "" as edtext, "" as deltext
                    FROM (SELECT title, location, date, amount, a.name, category, note
                    FROM transactions as t INNER JOIN accounts as a ON t.account_id = a.id INNER JOIN sessions as s ON s.session_key = ${session}
                    WHERE t.user_id = s.user_id ${title} ${location} ${account} ${before} ${after} ${category} ${note}
                    ORDER BY t.date DESC LIMIT ${limit}) as s)`, 
                    function (error, results, fields)
  {
    if      (error)               res.send(error);
    else if (results.length > 0)  res.render('history', { title: 'Finance', entries: results, query: req.query });
    else                          res.send("No history found");
  });
});

router.post('/history', function(req, res, next)
{
  date        = process_date(req.body.date);
  uid         = `"${req.cookies.uid}"`;
  account     = `"${req.body.account}"`;
  title       = `"${req.body.title}"`;
  location    = `"${req.body.location}"`;
  amount      = `"${req.body.amount}"`;
  category    = `"${req.body.category}"`;
  note        = `"${req.body.note}"`;
  id          = `"${req.body.id}"`;

  connection.query(`UPDATE transactions as t, accounts as a SET account_id = a.id, date = ${date}, title = ${title}, location = ${location},
                    amount = ${amount}, category = ${category}, note = ${note}
                    WHERE t.id = ${id} and name = ${account}`, function (error, results, fields)
  {
    if      (error) res.send(error);
    else            res.redirect('/history');
  });
});

module.exports = router;