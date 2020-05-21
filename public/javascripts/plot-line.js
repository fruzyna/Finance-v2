// process and sort values
var running = []
var dates = []
var total = Number(plot_data.pop().raw)
running.push(total)
dates.push(plot_data[plot_data.length - 1].date)

var currentDate = Date.parse(plot_data[plot_data.length - 1].date)
var stopDate = Date.parse(plot_data[0].date)
while (currentDate >= stopDate)
{
    if (plot_data.length > 0 && Date.parse(plot_data[plot_data.length - 1].date) == currentDate)
    {
        total -= Number(plot_data.pop().raw)
    }
    else
    {
        running.push(total)
        let date = new Date(currentDate)
        dates.push(`${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`)
        currentDate -= 86400000
    }
}
running = running.reverse()
dates = dates.reverse()

var n = running.length
var min = Math.min(...running)
var max = Math.max(...running)
var gap = (max - min) * 0.1

// svg bounds
var margin = {top: 50, right: 50, bottom: 50, left: 100}
var width = (3/4) * window.innerWidth - margin.left - margin.right
var height = (2/3) * window.innerHeight - margin.top - margin.bottom

// create svg
var svg = d3.select("#plot").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// build axes
var xScale = d3.scaleBand()
    .domain(dates)
    .range([0, width])

var yScale = d3.scaleLinear()
    .domain([min - gap, max + gap]) 
    .range([height, 0])

var xAxis = d3.axisBottom(xScale)
                .tickFormat((interval,i) => {
                    return i%parseInt(dates.length/(width/75)) !== 0 ? " ": interval;
                })

svg.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + height + ")")
    .call(xAxis)

svg.append("g")
    .attr("class", "y axis")
    .call(d3.axisLeft(yScale))

svg.append("g")
    .append("text")
        .attr("x", (1/2) * width)             
        .attr("y", -(1/2) * margin.top)
        .attr("text-anchor", "middle")
        .style("font-size", "24px") 
        .text("Balance History")

svg.append("g")
    .append("text")
        .attr("fill", "#000")
        .attr("y", height + (3/4) * margin.bottom)
        .attr("x", (1/2) * width)
        .attr("dy", "0.71em")
        .attr("text-anchor", "middle")
        .text("Days Back")

svg.append("g")
    .append("text")
        .attr("fill", "#000")
        .attr("transform", "rotate(-90)")
        .attr("y", -(3/4) * margin.left)
        .attr("x", -(1/2) * height)
        .attr("dy", "0.71em")
        .attr("text-anchor", "middle")
        .text("Balance")

// build line
var line = d3.line()
    .x(function(d, i) { return xScale(dates[i]); })
    .y(function(d) { return yScale(d); })
    .curve(d3.curveMonotoneX)

svg.append("path")
    .datum(running)
    .attr("class", "line")
    .attr("d", line)

// add dots
svg.selectAll(".dot")
    .data(running)
    .enter().append("circle")
    .attr("class", "dot")
    .attr("cx", function(d, i) { return xScale(dates[i]) })
    .attr("cy", function(d) { return yScale(d) })
    .attr("r", 5)