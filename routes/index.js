var express = require('express');
var router = express.Router();

// connect to db
var mysql = require('mysql');
var config = require('../sql-config.json')
var connection = mysql.createPool(config);

/**
 * Homepage
 */
router.get('/', function(req, res, next)
{
  if (req.cookies.uid === undefined)  res.redirect('/login');
  else
  {
    connection.query(`SELECT format(sum(amount), 2) as total FROM transactions
                      WHERE user_id = "${req.cookies.uid}"`, function (error, results, fields)
                      {
                        if      (error)               res.send(error);
                        else if (results.length > 0)  res.render('index', { title: 'Finance', name: req.cookies.name, total: results[0].total });
                        else                          res.redirect('/add');
                      });
  }
});

/**
 * Login
 */
router.get('/login', function(req, res, next)
{
  res.render('login', { title: 'Finance Login' });
});

router.post('/login', function(req, res, next)
{
  connection.query(`SELECT id FROM users WHERE username = "${req.body.user}"
                    and password = password("${req.body.pass}")`, function (error, results, fields)
  {
    if      (error) res.send(error);
    else if (results.length > 0)
    {
      res.cookie('uid', results[0].id);
      res.cookie('name', req.body.user);
      res.redirect('/');
    }
    else res.redirect('/login');
  });
});

/**
 * Add Entry
 */
router.get('/add', function(req, res, next)
{
  connection.query(`SELECT DISTINCT location FROM transactions
                    WHERE user_id = "${req.cookies.uid}"`, function (error, locations, fields)
  {
    if (error) res.send(error);
    else 
    {
      if (locations.length <= 0) locations = {};

      connection.query(`SELECT DISTINCT a.name
                        FROM transactions as t INNER JOIN accounts as a ON account_id = a.id
                        WHERE t.user_id = "${req.cookies.uid}"`, function (error, accounts, fields)
      {
        if (error) res.send(error);
        else 
        {
          if (accounts.length <= 0) accounts = {};

          connection.query(`SELECT DISTINCT category FROM transactions
                            WHERE user_id = "${req.cookies.uid}"`, function (error, categories, fields)
          {
            if (error) res.send(error);
            else
            {
              if (categories.length <= 0) categories = {};

              if (req.cookies.uid === undefined)  res.redirect('/login');
              else res.render('add', { title: 'Finance', locations: locations, accounts: accounts, categories: categories });
            }
          });
        }
      });
    }
  });
});

router.post('/add', function(req, res, next)
{
  date        = 'now()';
  if (req.body.date != '')
  {
    date      = `"${req.body.date}"`;
  }
  uid         = `"${req.cookies.uid}"`;
  account     = `"${req.body.account}"`;
  transfer    = `"${req.body.transfer}"`;
  title       = `"${req.body.title}"`;
  location    = `"${req.body.location}"`;
  amount      = `"${req.body.amount}"`;
  category    = `"${req.body.category}"`;
  note        = `"${req.body.note}"`;
  
  connection.query(`INSERT INTO transactions (user_id, account_id, date, title, location, amount, category, note)
                    SELECT ${uid}, id, ${date}, ${title}, ${location}, ${amount}, ${category}, ${note}
                    FROM accounts WHERE name = ${account}`, function (error, results, fields)
  {
    if (error)  res.send(error);
    else
    {
      id = results.insertId;
      if (req.body.transfer !== undefined && req.body.transfer != "")
      {
        amount = `"-${req.body.amount}"`;
        connection.query(`INSERT INTO transactions (user_id, account_id, date, title, location, amount, category, note, linked_transaction)
                          SELECT ${uid}, a.id, ${date}, ${title}, ${location}, ${amount}, ${category}, ${note}, max(t.id)
                          FROM accounts as a, transactions as t WHERE a.name = ${transfer} and t.user_id = ${uid}`, function (error, results, fields)
        {
          if (error)  res.send(error);
          else
          {
            connection.query(`UPDATE transactions
                              SET linked_transaction = (SELECT max(id) FROM transactions WHERE user_id = ${uid})
                              WHERE id = ${id}`, function (error, results, fields)
            {
              if (error)  res.send(error);
              else        res.redirect('/history');
            });
          }
        });
      }
      else res.redirect('/history');
    }
  });
});

/**
 * Add Account
 */
router.get('/add-account', function(req, res, next)
{
  if (req.cookies.uid === undefined)  res.redirect('/login');
  else                                res.render('add-account', { title: 'Finance' });
});

router.post('/add-account', function(req, res, next)
{
  uid   = `"${req.cookies.uid}"`;
  name  = `"${req.body.name}"`;

  connection.query(`SELECT id FROM accounts
                    WHERE user_id = ${uid} and name = ${name}`, function (error, results, fields)
  {
    if      (error)               res.send(error);
    else if (results.length > 0)  res.send('Account already exists');
    else
    {
      connection.query(`INSERT INTO accounts (user_id, name)
                        VALUES (${uid}, ${name})`, function (error, results, fields)
      {
        if (error)  res.send(error);
        else        res.redirect('/add-account');
      });
    }
  });
});

/**
 * Account Balances
 */
router.get('/accounts', function(req, res, next)
{
  if (req.cookies.uid === undefined)
  {
    res.redirect('/login');
    return;
  }

  connection.query(`SELECT format(sum(amount), 2) as balance, name
                    FROM transactions as t
                    INNER JOIN accounts as a ON account_id = a.id
                    WHERE t.user_id = "${req.cookies.uid}"
                    GROUP BY account_id
                    UNION
                    SELECT format(sum(amount), 2) as balance, "Total" as name
                    FROM transactions
                    WHERE user_id = "${req.cookies.uid}"`, function (error, results, fields)
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
  if (req.cookies.uid === undefined)
  {
    res.redirect('/login');
    return;
  }

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
  else                                      before = `AND datediff(t.date, "${before}") < 0`;

  after = req.query.after;
  if (after === undefined || after == '') after = '';
  else                                    after = `AND datediff(t.date, "${after}") >= 0`;

  category = req.query.category;
  if (category === undefined || category == '') category = '';
  else                                          category = `AND t.category = "${category}"`;

  note = req.query.note;
  if (note === undefined || note == '') note = '';
  else                                  note = `AND t.note = "${note}"`;

  connection.query(`(SELECT title, location, date_format(date, "%a %b %d %Y") as date, format(amount, 2) as amount, a.name, category, note
                    FROM transactions as t INNER JOIN accounts as a ON account_id = a.id
                    WHERE t.user_id = "${req.cookies.uid}" ${title} ${location} ${account} ${before} ${after} ${category} ${note}
                    ORDER BY t.date DESC LIMIT ${limit})
                    UNION
                    (SELECT "Total" as title, "" as location, "" as date, format(sum(s.amount), 2) as amount, "" as name, "" as category, "" as note
                    FROM (SELECT title, location, date, amount, a.name, category, note
                    FROM transactions as t INNER JOIN accounts as a ON account_id = a.id
                    WHERE t.user_id = "${req.cookies.uid}" ${title} ${location} ${account} ${before} ${after} ${category} ${note}
                    ORDER BY t.date DESC LIMIT ${limit}) as s)`, 
                    function (error, results, fields)
  {
    if      (error)               res.send(error);
    else if (results.length > 0)  res.render('history', { title: 'Finance', entries: results, query: req.query });
    else                          res.send("No history found");
  });
});

module.exports = router;