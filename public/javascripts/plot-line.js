// process and sort values
var running = [];
var total = Number(plot_data.pop().raw);
running.push(total);

var currentDate = Date.parse(plot_data[plot_data.length - 1].date);
var stopDate = Date.parse(plot_data[0].date);
while (currentDate >= stopDate )
{
    if (plot_data.length > 0 && Date.parse(plot_data[plot_data.length - 1].date) == currentDate)
    {
        total -= Number(plot_data.pop().raw)
    }
    else
    {
        running.push(total);
        currentDate -= 86400000;
    }
}
running = running.reverse()

var n = running.length;
var min = Math.min(...running);
var max = Math.max(...running);
var gap = (max - min) * 0.1;

// svg bounds
var margin = {top: 50, right: 50, bottom: 50, left: 50};
var width = 750 - margin.left - margin.right;
var height = 500 - margin.top - margin.bottom;

// create svg
var svg = d3.select("#plot").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// build axes
var xScale = d3.scaleLinear()
    .domain([0, n-1])
    .range([0, width]);

var yScale = d3.scaleLinear()
    .domain([min - gap, max + gap]) 
    .range([height, 0]);

svg.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(xScale));

svg.append("g")
    .attr("class", "y axis")
    .call(d3.axisLeft(yScale));

// build line
var line = d3.line()
    .x(function(d, i) { return xScale(i); })
    .y(function(d) { return yScale(d); })
    .curve(d3.curveMonotoneX);

svg.append("path")
    .datum(running)
    .attr("class", "line")
    .attr("d", line);

// add dots
svg.selectAll(".dot")
    .data(running)
    .enter().append("circle")
    .attr("class", "dot")
    .attr("cx", function(d, i) { return xScale(i) })
    .attr("cy", function(d) { return yScale(d) })
    .attr("r", 5);