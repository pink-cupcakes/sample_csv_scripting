const express = require('express');
const fs = require('fs');
const moment = require('moment');
const csvWriter = require('csv-write-stream');
const util = require('util');
const app = express();
const writer = csvWriter();

let today = moment(new Date());

let rawData;
let totalTenure = 0;
let totalHeadcount = 0;
let averageTenure;
let rootNodes = [];
let directReports = {};
let minReports;
let maxReports = 0;

const buildNodes = (id) => {
  id = Number(id);
  let branch = {
    employeeID: id,
    reports: []
  };

  if (directReports[id] === undefined) {
    for (let i = 0; i < rootNodes.length; i++) {
      if (rootNodes[i].employeeID == id) {
        branch.reports.push(rootNodes[i].reports);
        rootNodes.splice(i, 1);
        return branch;
      }
    };
    return branch;
  };

  let reportingEmployees = directReports[id];
  let isManager = reportingEmployees.shift();

  delete directReports[id];

  //handle min/max direct reports
  if (isManager) {
    if (reportingEmployees.length > maxReports) {
      maxReports = reportingEmployees.length;
    };
    if (minReports === undefined || reportingEmployees.length < minReports) {
      minReports = reportingEmployees.length;
    };
  };
  
  //base case
  if (reportingEmployees.length === 0) {
    return branch;
  };

  //recursively build tree
  branch.reports = reportingEmployees.map((reports) => {
    return buildNodes(reports);
  });
  return branch;
}

fs.readFile('./org_zero.csv', 'utf8', function (err, data) {
  if (err) {
    return console.log(err);
  }
  rawData = data.split('\n');
  rawData.shift();
  rawData.forEach((employee) => {
    let employeeData = employee.split(',');
    let startDate = employeeData[9].split('/');

    //adjust tenure length and headcount
    if (startDate.length > 1) {
      let tenure = moment(startDate, 'MM/DD/YY').diff(today, 'months', true);
      totalTenure += tenure;
      totalHeadcount += 1;
    };

    //generate employeeID + direct report hash map
    let employeeID = Number(employeeData[0]);
    let managerID = Number(employeeData[12]);

    //initialize isManager
    let isManager;
    if (employeeData[7] === 'FALSE') {
      isManager = false;
    } else {
      isManager = true;
    };

    //initialize employeeID
    if (!directReports[employeeID]) {
      directReports[employeeID] = [isManager];
    } else {
      directReports[employeeID].splice(0, 0, isManager);
    };

    //initialize managerID
    if (managerID === 0 || !managerID) {
      rootNodes.push(employeeID);
    } else if (!directReports[managerID]) {
      directReports[managerID] = [employeeID];
    } else {
      directReports[managerID].push(employeeID);
    };
  });
  averageTenure = Math.round(Math.round(totalTenure * -1 / totalHeadcount) / 12);
  
  rootNodes = rootNodes.map((root) => {
    return buildNodes(root);
  });

  for (let roots in directReports) {
    rootNodes.push(buildNodes(roots));
  };

  fs.writeFileSync('orgchart.csv', JSON.stringify(rootNodes, null, 2));
  console.log(`The average tenure at Org Zero is ${averageTenure} years.`)
  console.log(`The minimum number of direct reports for managers at Org Zero is ${minReports}.`)
  console.log(`The maximum number of direct reports for managers at Org Zero is ${maxReports}.`);
});