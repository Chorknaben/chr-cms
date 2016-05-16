const http = require("http");
const express = require("express");
const bodyParser = require("body-parser");
var randomstring = require("randomstring");
var child_process = require("child_process");
var busboy = require("connect-busboy")
var backend = express();
backend.use(busboy());
var fs = require("fs");
var ini = require("ini");

var config = ini.parse(fs.readFileSync("./server.config", "utf-8"))
console.log(config);

function dieUnlessConfigSupplied($config, mandatory){
	for (var i of mandatory){
		var tempObject = $config;
		for(var subObject of i.split(".")){
			tempObject = tempObject[subObject]
			if(tempObject === undefined){
				console.error("Mandatory Option " + i + " fehlt. Abbruch");
				process.exit(1)
			}
		}
	}
}
dieUnlessConfigSupplied(config, 
		["server.host", "server.port", 
		"data.dataDirectory", "data.locations.calendar", "data.locations.newsticker", "data.locations.images"]);

var kalender = express.Router();
var newsticker = express.Router();
var bilder = express.Router();
var presse =express.Router();

var eventsJson;
fs.readFile(__dirname + config.data.dataDirectory + config.data.locations.calendar , "utf8", function(err , data){
	eventsJson = JSON.parse(data)
});

var newstickerJson;
fs.readFile(__dirname + config.data.dataDirectory + config.data.locations.newsticker , "utf8", function(err , data){
	newstickerJson = JSON.parse(data)
});


function writeEventsJson(){
	// Save Changes
	// Evtl. erst später speichern. also call auf writeFile erst bei klick auf einen "Deploy" - Button ausführen, oder so
	fs.writeFile(__dirname + config.data.dataDirectory + config.data.locations.calendar, JSON.stringify(eventsJson), function(error){
		if(error){
			return console.error(error);
		}
		console.log("Schreibvorgang auf events.json erfolgreich ausgeführt.");
	});
}

function writeNewstickerJson(){
	fs.writeFile(__dirname + config.data.dataDirectory + config.data.locations.newsticker, JSON.stringify(newstickerJson), function(error){
		if(error){
			return console.error(error);
		}
		console.log("Schreibvorgang auf newsticker.json erfolgreich ausgeführt.");
	});
}


kalender.get("/get", function(request, response){
	response.end(JSON.stringify(eventsJson));
});

var jsonParser = bodyParser.json();

kalender.post("/add", jsonParser, function(request, response){
	// TODO PARSE REQUEST BODY, VALIDATE, APPEND TO JSON FILE
	// OR RETURN AN ERROR
	console.info("In /kalender/add");
	if (!request.body) return response.sendStatus(400);

	var expectedKeys = ["date", "location", "time", "title"];
	var dataReceived = request.body;

	for (var i = expectedKeys.length - 1; i >= 0; i--) {
		if (!dataReceived.hasOwnProperty(expectedKeys[i])){
			response.end(JSON.stringify({
				err: "Einer von date,location,time,title keys wurde nicht gefunden",
				code: "kal_1_err"
			}));
			return;
		}
	};

	for (var i = eventsJson["events"].length - 1; i >= 0; i--) {
		var amountDuplicateKeys = 0;
		for (var m = expectedKeys.length - 1; m >= 0; m--) {
			if(dataReceived[expectedKeys[m]] == eventsJson["events"][i][expectedKeys[m]]){
				amountDuplicateKeys++;

			}
		};
		console.log("amountDuplicateKeys: " + amountDuplicateKeys);
		if (amountDuplicateKeys == 4){
			// exaktes duplikat
			response.end(JSON.stringify({
					err: "Duplikat mit bestehender Eventdatenbank erkannt. Vorgang wird abgebrochen.",
					code: "kal_2_err"
			}));
			return;
		}
	};

	eventsJson["events"].push(dataReceived);
	writeEventsJson();
	response.end(JSON.stringify(eventsJson));



	// Expected POST Request Body is a calendar object
	/*
        {
            "date": "07.12.2014",
            "location": "Marktplatz Biberach (Ri&szlig;)",
            "time": "19.00",
            "title": "Biberacher Christkindlesmarkt"
        }
	*/



});
kalender.post("/rm", jsonParser, function(request, response){
	// TODO PARSE REQUEST BODY, VALIDATE, REMOVE FROM JSON FILE
	console.info("In /kalender/rm");
	if (request.body["type"] == "byID"){
		var deletedElement = eventsJson["events"].splice(request.body["object"], 1);
		response.end(JSON.stringify(deletedElement));
		writeEventsJson();
		return;

	} else if (request.body["type"] == "byObjType"){
		// TODO Implement if needed
		var object = request.body["object"];
		for (var i = eventsJson["events"].length - 1; i >= 0; i--) {
			if (eventsJson["events"][i].date === object.date &&
				eventsJson["events"][i].time === object.time &&
				eventsJson["events"][i].location === object.location &&
				eventsJson["events"][i].title === object.title){
				console.log("Element to delete found at idx: " + i);
			var deletedElement = eventsJson["events"].splice(i, 1);
			response.end(JSON.stringify(deletedElement));
			writeEventsJson();
			return;
			}
		};
	} else {
		response.end(JSON.stringify({
			err: "angegebener Suchalgorithmus für JSON type key ist unbekannt. vorgang wird abgebrochen.",
			code: "kal_3_err"
		}));
		return;
	}

});

newsticker.get("/get", function(request, response){
	response.end(JSON.stringify(newstickerJson));

});
newsticker.post("/set", jsonParser, function(request, response){
	var dataReceived = request.body;
	if(!dataReceived["text"]){
		response.end(JSON.stringify({
			err: "Kein Inhalt",
			code: "news_1_err"
		}));
	} else{
		console.log("Recieved:" + JSON.stringify(dataReceived));
		newstickerJson = {news:dataReceived["text"]};
		writeNewstickerJson();
		response.end(JSON.stringify(newstickerJson));
	}

});

function readJson(filename){
	try {
		var s = fs.readFileSync(__dirname + config.data.dataDirectory + "/json/" + filename, "utf8");
		return JSON.parse(s);
	} catch(error){
		console.warn(error);
		return null;
	}
}
function writeJson(filename, json){
	try {
		fs.writeFileSync(__dirname + config.data.dataDirectory + "/json/" + filename, JSON.stringify(json));
	} catch(error){
		console.warn(error);
		return null;
	}
}

presse.get("/articles", function(request, response){
	response.end(JSON.stringify(readJson("presse.json").presse));
});

presse.post("/articles/up", function(request, response){
	var url = request.query.url;
	if (url){
		var json = readJson("presse.json");
		if (json.presse[0].url != url){
			for (var i = 0; i<json.presse.length;i++){
				if (json.presse[i].url == url){
					var el = json.presse.splice(i, 1);
					json.presse.splice(i-1, 0, el[0]);
					writeJson("presse.json", json);
					return response.end("ok");
				}
			}
		}
	}
	response.end("err");
});

presse.post("/articles/down", function(request, response){
	var url = request.query.url;
	console.log(request.query);
	if (url){
		var json = readJson("presse.json");
		if (json.presse[json.presse.length - 1].url != url){
			for (var i = 0; i<json.presse.length;i++){
				if (json.presse[i].url == url){
					var el = json.presse.splice(i, 1);
					json.presse.splice(i+1, 0, el[0]);
					writeJson("presse.json", json);
					return response.end("ok");
				}
			}
		}
	}
	response.statusCode = 500;
	response.end("err");

});

presse.post("/upl", function(request,response){
	var fstream;
	console.log(request.query);
	if (request.busboy && request.query.date && request.query.caption && request.query.name){
		request.pipe(request.busboy);
		request.busboy.on('file', function(fieldname, file, filename){
			var len = 20 * readJson("presse.json").presse.length + 1;
			console.log("write /temp/"+len);
			filename = __dirname + "/temp/" + len;
			fstream = fs.createWriteStream(filename)
			file.pipe(fstream);
			fstream.on('close', function(){
				var r = readJson("presse.json");	
				r.presse.unshift({
					caption: request.query.caption,
					date: request.query.date,
					name: request.query.name,
					url: '/presse/' + len
				});
				writeJson('presse.json', r);
				console.log("Updated presse.json");

				child_process.spawn('cp', [filename, 'dataSymlink/presse/real/' + len]);
				child_process.spawn('cp', [filename, 'dataSymlink/presse/thumbs/' + len]);
				console.log("Copied file");
				response.end("ok");

			})
		})
	} else {
		response.statusCode = 500;
		response.end("fail");
	}
})

presse.post("/articles/delete", function(request,response){
	if (request.query.name){
		var prs = readJson("presse.json").presse;
		console.log(prs);
		console.log("Got query: " + request.query.name);
		for (var i = 0; i < prs.length; i++){
			if (prs[i].url == request.query.name){
				console.log("Article exists. (found at idx="+i+") Del.");
				var id = prs[i].url.substring(prs[i].url.lastIndexOf("/") + 1);
				var deleted = prs.splice(i,1);
				console.log(deleted);
				try{
					fs.unlinkSync(__dirname + config.data.dataDirectory + "/presse/real/" + id);
					fs.unlinkSync(__dirname + config.data.dataDirectory + "/presse/thumbs/" + id);
				} catch(error){
					console.warn(error);
				}
				writeJson("presse.json", {presse: prs});

				response.end("ok");
			}
		}	
	} else {
		response.statusCode = 404;
		response.end("err");
	}
})

var metaJson = {};
function readMetaJson(){
	try{
	    metaJson = JSON.parse(fs.readFileSync(__dirname + config.struktur.bilder + "/" + "meta", "utf-8"));
	} catch(error){
		console.warn(error);
	}
    return metaJson;
}
function writeMetaJson(prod){
    metaJson["prod"] = prod;
    fs.writeFileSync(__dirname + config.struktur.bilder + "/meta", JSON.stringify(metaJson), 'utf8');
    console.log("meta write ok");
    setProduction();
}

function setProduction(){
	readMetaJson();
	console.log("Production: ln -sr bilderStrukturen/" + metaJson.prod + " dataSymlink/image");
	child_process.spawnSync('rm', ['dataSymlink/image', 'dataSymlink/json/bilder.json']);
	child_process.spawn('ln', ['-sr', 'bilderStrukturen/' + metaJson.prod, 'dataSymlink/image']); 
	child_process.spawn('ln', ['-sr', 'bilderStrukturen/' + metaJson.prod + ".json", 'dataSymlink/json/bilder.json']); 
}

var allStructures;
function getStructures(){
	allStructures = fs.readdirSync(__dirname + config.struktur.bilder);
	allStructures = allStructures.filter(function(val){
		return val.indexOf("_") == -1 && fs.statSync(__dirname + config.struktur.bilder + "/" + val).isDirectory()
	})
	return allStructures;

}
bilder.get("/strukturen", function(request, response){
	// Read directories in struktur Directory
	getStructures();
	// Read Metadata File
	var metaJSON = readMetaJson();


	// Merge and repond
	response.end(JSON.stringify({
		"meta" : metaJSON,
		"strukturen" : allStructures
	}));
});

bilder.post("/upload", function(request, response){
	var fstream;
	if (request.busboy){
		request.pipe(request.busboy);
		request.busboy.on('file', function(fieldname, file, filename){
			var newFilename = randomstring.generate(10);
			fstream = fs.createWriteStream(__dirname + "/temp/" + newFilename);
			file.pipe(fstream);
			fstream.on('close', function(){
				response.end(JSON.stringify({"success":newFilename}));
				startStrukturJob(newFilename);
			});
		});
	}
});

bilder.post("/prod", jsonParser, function(request, response){
	var data = request.body;
	getStructures();
	if (data["prod"] && allStructures.indexOf(data["prod"]) != -1){
		writeMetaJson(data["prod"]);
	} else {
		response.statusCode = 404;
	}
	response.end();
});

bilder.get("/axx", function(request, response){
	if(request.query.name && getStructures().indexOf(request.query.name) != -1){
		var cnt = fs.readdirSync("bilderStrukturen/_"+request.query.name + "/ChorservBilderStruktur/");
		cnt = cnt.filter(function(val){
			return fs.statSync(__dirname + config.struktur.bilder + "/_" + request.query.name + "/ChorservBilderStruktur/" + val).isDirectory()
		});
		response.end(JSON.stringify({content: cnt}));
	} else {
		response.statusCode = 404;
		response.end();
	}
});

function alnum(str){
	//return str.match(/^[0-9a-z]+$/);
	return true;
}

bilder.post("/change", jsonParser, function(request, response){
	var data = request.body;
	getStructures();
	if (allStructures.indexOf(data.name) != -1){
		if (data["rm"]){
			for(var i = 0; i<data["rm"].length; i++){
				/*if (!alnum(el)){
					console.warn("mall: " + el);
					return;
				}*/
				console.log("del " + data.name + "nd " + data["rm"][i]);
				child_process.spawnSync('rm', ['-r', "bilderStrukturen/_"+data.name+"/ChorservBilderStruktur/"+data["rm"][i]]);
			}
		}
		if (data["mrg"]){
			if (!alnum(data["mrg"])) {
				console.warn("mall: " + data["mrg"]);
				return;
			}
			child_process.spawnSync('./mvt.sh', ['bilderStrukturen/_'+data.name+'/ChorservBilderStruktur', 'bilderStrukturen/_'+data["mrg"]+'/ChorservBilderStruktur/']);

		}
		console.log("Changes applied, starting job.");
		if(data.rm){
			littleJob(data.name)
		} else {
			littleJob(data.mrg);
		}
		response.end("ok");

	} else {
		response.statusCode = 404;
	}
});

bilder.post("/commit", jsonParser, function (request, response){
    // post param: transaction id, name, prod
    var data = request.body;
    var item =  job_collection[data["transaction_id"]];
    if (item){
        // commit
        if (data["name"].indexOf("/") != -1 || data["name"].indexOf(".") != -1){
            response.end(JSON.stringify({err: "Malformed Name"}));
            return;
        }
        try{
	        fs.rename("temp/"+item["stage30"]["file"]+".json", "bilderStrukturen/"+data["name"]+".json");    
	        fs.rename("temp/"+item["stage30"]["directory"], "bilderStrukturen/"+data["name"]);
	        child_process.spawn('mv', [item["stage10"].extracteddir, "bilderStrukturen/_"+data["name"]]);
        } catch(err) {
        	response.end(JSON.stringify({err: "Fatal FileSystem Error"}));
        	return;
        }
        if (data["prod"]){
            readMetaJson();
            //TODO insecure
            writeMetaJson(data["name"]);
        }
        response.end(JSON.stringify({name: data.name}));


    }
});

var job_collection = {};
bilder.get("/jobs", function (request, response){
	response.end(JSON.stringify(job_collection));
});

function littleJob(extrdir, cb){
	// _dir modified, rebuild dir and reinstatiate symlink
	// dir without trailing thing is meant
	jobname = extrdir + "_rebuild_" + randomstring.generate(10)

	job_collection[jobname] = {}
	job_collection[jobname].end = 0;

	//del orig folder
	if (extrdir.indexOf("/") != -1) return;
	child_process.spawnSync("rm", ["-r", "bilderStrukturen/" + extrdir]);
	var outF = "bilderStrukturen/" + extrdir + ".json"
	var outD = "bilderStrukturen/" + extrdir;
	var extracteddir = "bilderStrukturen/_" + extrdir;
	fs.mkdirSync(outD);
	var strukturlog = fs.createWriteStream('./struktur_job_out', {flags: 'w'});
	var struktur = child_process.spawn(__dirname + "/" + config.requiredapps.struktur + "/struktur.py",
		["-f", outF, "-w", outD, extracteddir + config.struktur.bilderDirectoryName]);	
	struktur.stdout.pipe(strukturlog);
	struktur.on('close', (code) => {
		job_collection[jobname].end = 1;
		if (cb) cb();
	});

}

function startStrukturJob(file, extrdir){
	function humanVerification(file, json, directory){
		job_collection[file].currentstage = 30;
		job_collection[file]["stage30"] = {file: json, directory: directory};
	}
	function verifyAndRunStruktur(file, extracteddir){
		/* stage 20 begin */
		job_collection[file].currentstage = 20;
		job_collection[file]["stage20"] = {};

		var _utF = randomstring.generate(12);
		var outF = __dirname + "/temp/" + _utF + ".json"; 

		var _utD = randomstring.generate(13);
		var outD = __dirname + "/temp/" + _utD;

		fs.mkdirSync(outD);
		var strukturlog = fs.createWriteStream('./struktur_job_out', {flags: 'w'});
		var struktur = child_process.spawn(__dirname + "/" + config.requiredapps.struktur + "/struktur.py",
			["-f", outF, "-w", outD, extracteddir + config.struktur.bilderDirectoryName]);	
		struktur.stdout.pipe(strukturlog);
		struktur.on('close', (code) => {
			job_collection[file]["stage20"].exit = code;
			if(code == 0){
				// Nur randomstring segmente in job_collection laden, um path disclosure zu vermeiden....
				humanVerification(file, _utF, _utD);
			}
		});

	}
	job_collection[file] = {};
	job_collection[file].currentstage = 10;
	var dir = __dirname + "/temp/" + randomstring.generate(11);
	const szip = child_process.spawn(config.requiredapps.p7zip, ['x', __dirname + "/temp/" + file, '-o' + dir]);
	szip.on('close', (code) => {

		/* stage 10 begin */
		job_collection[file]["stage10"] = {};
		job_collection[file]["stage10"].exit = code;
		job_collection[file]["stage10"].extracteddir = dir;

		if (code == 0){
			verifyAndRunStruktur(file, dir);
		}
	});
}


backend.use("/kalender", kalender);
backend.use("/newsticker", newsticker);
backend.use("/bilder", bilder);
backend.use("/static", express.static(__dirname + "/static"));
backend.use("/presse", presse);
backend.get(["/", "/index.html"], function(request, response){
	response.sendFile("index.html", {root : __dirname});
})

var server = backend.listen(config.server.port, config.server.host, function(){
	var address = server.address();
	console.log("Backend gestartet auf: http://%s:%s", address.address, address.port);
});
