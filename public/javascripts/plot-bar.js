// clean up data, and determine bounds
var min = 0
var max = 0
accounts = []
plot_data.forEach(function (account, index)
{
    // ignore total
    if (account.name != "Total")
    {
        accounts.push(account)
        let bal = Number(account.raw)
        account.balance = bal
        if (bal > max)
            max = bal
        else if (bal < min)
            min = bal
    }
})
var adj = (max - min) * 0.1
max += adj
min -= adj

// svg dimensions
var margin = {top: 50, right: 50, bottom: 50, left: 100}
var width = window.innerWidth / 2 - margin.left - margin.right
var height = window.innerHeight / 2 - margin.top - margin.bottom

// create svg
var svg = d3.select("#plot").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    
var g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")")

// build axes
var x = d3.scaleBand()
	.rangeRound([0, width])
	.padding(0.05)

var y = d3.scaleLinear().rangeRound([height, 0])

x.domain(accounts.map(function (d) { return d.name }))

y.domain([min, max])

g.append("g")
    .append("text")
        .attr("x", (1/2) * width)             
        .attr("y", -(1/2) * margin.top)
        .attr("text-anchor", "middle")
        .style("font-size", "24px") 
        .text("Account Totals")

g.append("g")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(x))
    .append("text")
        .attr("fill", "#000")
        .attr("y", (3/4) * margin.bottom)
        .attr("x", (1/2) * width)
        .attr("dy", "0.71em")
        .attr("text-anchor", "middle")
        .text("Account")

g.append("g")
    .call(d3.axisLeft(y))
    .append("text")
        .attr("fill", "#000")
        .attr("transform", "rotate(-90)")
        .attr("y", -(3/4) * margin.left)
        .attr("x", -(1/2) * height)
        .attr("dy", "0.71em")
        .attr("text-anchor", "middle")
        .text("Balance")

// create bars
g.selectAll(".bar")
    .data(accounts)
    .enter().append("rect")
    .attr("class", "bar")
    .attr("x", function (d) { return x(d.name) })
    .attr("y", function (d) {
        if (d.balance > 0)
            return y(d.balance)
        else
            return y(0)
    })
    .attr("width", x.bandwidth())
    .attr("height", function (d) {
        return height - y(Math.abs(d.balance) + min)
    })
    .attr("fill", function (d) {
        if (d.balance > 0)
            return "#0A0"
        else
            return "#A00"
    })
    .on("mousemove", function(d, i) {
        let tt = d3.select("#tooltip")
            .style("top", `${event.pageY+15}px`)
            .style("left", `${event.pageX+15}px`)
        tt.html("")
        tt.append("span").text(d.name)
        tt.append("br")
        tt.append("span").text(`$${d.balance.toFixed(2)}`)
    })
    .on("mouseout", function() { d3.select("#tooltip").html("") })