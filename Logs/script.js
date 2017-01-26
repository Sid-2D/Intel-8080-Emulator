var fs = require('fs');
var reg = /OpCode: (\w+)/g;
var reg1 = /OpCode: (\w+)/;
var log = fs.readFileSync("Build0.1.txt", "utf8");
var codes = log.match(reg);
var unique = {};
codes.forEach(function (line) {
	if (!unique[line.match(reg1)[1]]) {
		unique[line.match(reg1)[1]] = 1;
	}
});
console.log(JSON.stringify(unique, null, 2));