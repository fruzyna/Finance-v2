// clean up data, and determine bounds
var min = 0;
var max = 0;
plot_data.forEach(function (account, index)
{
    let bal = Number(account.raw);
    account.balance = bal;
    if (bal > max)
        max = bal;
    else if (bal < min)
        min = bal;
});
var adj = (max - min) * 0.1;
max += adj;
min -= adj;

// svg dimensions
var margin = {top: 50, right: 50, bottom: 50, left: 50};
var width = 1250 - margin.left - margin.right;
var height = 750 - margin.top - margin.bottom;

// create svg
var svg = d3.select("#plot").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);
    
var g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// build axes
var x = d3.scaleBand()
	.rangeRound([0, width])
	.padding(0.1);

var y = d3.scaleLinear().rangeRound([height, 0]);

x.domain(plot_data.map(function (d) { return d.name; }));

y.domain([min, max]);

g.append("g")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(x));

g.append("g")
    .call(d3.axisLeft(y))
    .append("text")
        .attr("fill", "#000")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", "0.71em")
        .attr("text-anchor", "end")
        .text("Balance");

// create bars
g.selectAll(".bar")
    .data(plot_data)
    .enter().append("rect")
    .attr("class", "bar")
    .attr("x", function (d) { return x(d.name); })
    .attr("y", function (d) {
        if (d.balance > 0)
            return y(d.balance);
        else
            return y(0);
    })
    .attr("width", x.bandwidth())
    .attr("height", function (d) {
        return height - y(Math.abs(d.balance) + min);
    })
    .attr("fill", function (d) {
        if (d.balance > 0)
            return "#0A0";
        else
            return "#A00";
    });