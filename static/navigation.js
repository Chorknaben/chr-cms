angular.module("backend", [])
	.directive('compile', function($compile, $timeout){
		return {
			restrict : 'A',
			link: function(scope, elem, attrs){
				$timeout(function(){
					$compile(elem.contents())(scope);
				});		
			}
		}
	})
	.filter('to_trusted', ['$sce', function($sce){
		return function(text){
			return $sce.trustAsHtml(text);
		}
	}])
	.controller("NavigationController", function(){
		var nav = this;

		nav.CALENDAR = 0x01;
		nav.BILDER = 0x02;
		nav.NEWSTICKER = 0x03;
		nav.TEXTE = 0x04;
		nav.SERVERHEALTH = 0x05;
		nav.BACKGROUND = 0x06;
		nav.IDE = 0x07;
		nav.DEFAULT = 0x00;
		nav.PRESSE = 0x08;

		nav.selectedElement = nav.DEFAULT;

		nav.activate = function(id){
			nav.selectedElement = id;
			if (nav.selectedElement != nav.DEFAULT){
				nav.showNav = false;
			} else {
				nav.showNav = true;
			}
		};

		nav.isActive = function(el){
			return el == nav.selectedElement;
		}

		nav.showNav = true;
		nav.showNavigation = function(){
			return nav.showNav;
		}
	})
	.controller("KalenderController", function($scope, $http){
		$scope.entryDatabase = {"events":[]};

		$scope.newItem = {
			date: undefined,
			time: undefined,
			title: "",
			loc: "",
		}

		$scope.neuerTermin = false;
		$scope.toggleNeuerTermin = function(){
			$scope.neuerTermin = !$scope.neuerTermin;
		}

		$scope.entries = function(){
			return $scope.entryDatabase["events"].length;
		}

		$scope.getEntryDatabase = function(){
			return $scope.entryDatabase["events"];
		}

		$scope.isBeforeNow = function(momentDate){
			return momentDate.isBefore(moment());
		}

		$scope.allInputsValid = function(){
			for (var i = 0; i<=3; i++){
				if($scope.validateInput(i)) return false;
			}
			return true;
		}

		$scope.validateInput = function(d){
			switch(d){
				case 0: return $scope.newItemForm.date.$error.required || $scope.newItemForm.date.$error.date
				case 1: return $scope.newItemForm.time.$error.required || $scope.newItemForm.time.$error.time
				case 2: return $scope.newItemForm.title.$error.required
				case 3: return $scope.newItemForm.loc.$error.required
			}
		}

		$scope.add = function(){
			var localOperateOn = $scope.entryDatabase;
			var newItem = {
				date: moment($scope.newItem.date),
				location: $scope.newItem.loc,
				time: moment($scope.newItem.time).format("HH:mm"),
				title: $scope.newItem.title
			};
			/*localOperateOn["events"].push(newItem);
			localOperateOn["events"].sort(compareMilliseconds);*/

			var transmitter = newItem;
			transmitter.date = transmitter.date.format("DD.MM.YYYY");
			console.log("Übermittle:");
			console.log(JSON.stringify(transmitter));
			$http({
				method: "POST",
				url: "/kalender/add",
				data: JSON.stringify(transmitter)
			}).success(function(data){
				$scope.performKalenderQuery();
				$scope.newItem = {};
			});

			console.log($scope.entryDatabase);
		}



		var compareMilliseconds = function(a, b){
			if(a.date.unix() > b.date.unix()) return -1;
			if(a.date.unix() < b.date.unix()) return 1;
			return 0;
		}

		$scope.rm = function(element){
			var copy = JSON.parse(JSON.stringify(element));
			copy.date = moment(copy.date).format("DD.MM.YYYY")
			var request = {
				type: "byObjType",
				object: copy
			}
			console.log("Removing: " + JSON.stringify(request));
			$http({
				method: "POST",
				url: "/kalender/rm",
				data: JSON.stringify(request)
			}).success(function(data){
				console.log(data);
				$scope.performKalenderQuery();
			});
			
		}


		$scope.performKalenderQuery = function(){
			$http({
				method: "GET",
				url: "/kalender/get"
			}).success(function(data){
				for(var i = 0; i<data["events"].length; i++){
					data["events"][i].date = moment(data["events"][i].date, "DD.MM.YYYY");
				}
				data["events"].sort(compareMilliseconds);
				$scope.entryDatabase = data;

			})
		}
		$scope.performKalenderQuery();
	})
	.controller("NewstickerController", function($scope, $http){
		$scope.ticker = [];
		$scope.getNewsticker = function(){
			return $scope.ticker;
		}
		$scope.addNews = function(){
			$scope.ticker.push("neuer ticker");
		}
		$scope.saveNews = function(){
			alert(JSON.stringify($scope.ticker));
			$http({
				method: "POST",
				url : "/newsticker/set",
				data: JSON.stringify({text:$scope.ticker})
			}).success(function(data){
				alert(data);
			});
		}
		$scope.rm = function(idx){
			$scope.ticker.splice(idx, 1);
		}
		$http({
			method: "GET",
			url : "/newsticker/get"
		}).success(function(data){
			$scope.ticker = data["news"];
		});
	})
	.service('fileUpload', ['$http', function ($http) {
	    this.uploadFileToUrl = function(file, uploadUrl, success, failure){
	    	if(success === undefined) success = function(){};
	    	if(failure === undefined) failure = function(){};
	        var fd = new FormData();
	        fd.append('file', file);
	        $http.post(uploadUrl, fd, {
	            transformRequest: angular.identity,
	            headers: {'Content-Type': undefined}
	        })
	        .success(success).error(failure);
	    }
	}])
	.controller('transact', function($scope){
		$scope.showDialog = false;
		$scope.dcall = null;
		$scope.args = {};

		$scope.$on("transactionRequest", function(event, arg){
			$scope.transactionDialog(arg.title, arg.desc, function(){
				return arg.onok($scope.args);
			});
		});

		$scope.$on("setTransaction", function(event, arg){
			$scope.setTransaction(arg);
		})

		$scope._dialogOK = function(){
			$scope.dcall();
			$scope.showDialog = false;
		}
		$scope.transactionDialog = function(title, desc, onok){
			$scope.dialogTitle = title;
			$scope.dialogBody = desc;
			$scope.dcall = onok;
			$scope.showDialog = true;
		}
		$scope.setTransaction = function(text){
			document.getElementById("transaction_status").innerHTML = text;
			$scope.addConsoleLine(text);
		}
		$scope.addConsoleLine = function(line){
			var e =document.getElementById("console");
			e.innerHTML = line + "<br/>" + e.innerHTML;
		}

	})
	.controller("IDEController", function($scope, $http){
		var myCodeMirror = CodeMirror.fromTextArea(document.getElementById("codemirror"), {
			mode: "javascript",
			value : "function ohai(){};\n",
			theme: "solarized"
		});
	})
		// $scope.submit = function(){
		// 	var f = document.getElementById('file').files[0];
		// 	$scope.setTransaction("Upload..");	
		// 	fileUpload.uploadFileToUrl(f, "/bilder/upload", function(suc){
		// 		$scope.setTransaction("Upload Complete.");	
		// 		$scope.pollState();
		// 	}, function(fail){
		// 		$scope.setTransaction("Upload failed.");
		// 	});

		// 	if (f === null){
		// 		alert("no file duh");
		// 	} 
		// }
	.controller("PRSController", function($scope, $rootScope, $http, fileUpload){
		$scope.presse = {}
		$scope.data = {}

		$scope.getPresse = function(){
			return $scope.presse;
		}	
		$scope.del = function(what){
			$rootScope.$broadcast('setTransaction', 'transact.delete');
			$http.post("/presse/articles/delete?name=" + what).success(function(s){
				$rootScope.$broadcast('setTransaction', 'delete ok');
				$scope.performPresseQuery();
			}).error(function(e){
				$rootScope.$broadcast('setTransaction', 'delete failed');
				$scope.performPresseQuery();
			});
		}
		$scope.up = function(url){
			$rootScope.$broadcast('setTransaction', 'transact.mv -1');
			$http.post("/presse/articles/up?url=" + url).success(function(s){
				$rootScope.$broadcast('setTransaction', 'move OK');
				$scope.performPresseQuery();
			}).error(function(e){
				$rootScope.$broadcast('setTransaction', 'move FAIL');
				$scope.performPresseQuery();
			});
		}
		$scope.down = function(url){
			$rootScope.$broadcast('setTransaction', 'transact.mv +1');
			$http.post("/presse/articles/down?url=" + url).success(function(s){
				$rootScope.$broadcast('setTransaction', 'move OK');
				$scope.performPresseQuery();
			}).error(function(e){
				$rootScope.$broadcast('setTransaction', 'move FAIL');
				$scope.performPresseQuery();
			});

		}
		$scope.submit = function(){
			if ($scope.data){
				// todo do in angular style
				if ($scope.data.caption && $scope.data.desc && $scope.data.date){
					var f = document.getElementById('file_img').files[0];	
					if (f === undefined){
					 	return $rootScope.$broadcast('setTransaction', 'Error: Keine Datei');
					}
					$rootScope.$broadcast('setTransaction', 'Upload..');
					var uri = "/presse/upl?name=" + encodeURIComponent($scope.data.desc) + "&caption=" +
						encodeURIComponent($scope.data.caption) + "&date=" + encodeURIComponent(
								$scope.data.date.getDate() + "." + $scope.data.date.getMonth() + "." +
								$scope.data.date.getFullYear()
							);
					console.log(uri);
					return fileUpload.uploadFileToUrl(f, uri, function(suc){
						$rootScope.$broadcast('setTransaction', 'OK!');
					 }, function(fail){
						$rootScope.$broadcast('setTransaction', 'Failed!');
					});
				} else {
					console.log($scope.data);
					$rootScope.$broadcast('setTransaction', 'Error: Alle Felder sind required');
				}
			}

		}
		$scope.performPresseQuery = function(){
			$http.get("/presse/articles").success(function(s){
				if (s){
					$scope.presse = s;
				}	
			}).error(function(e){
				alert(e);
			});
		}
		$scope.performPresseQuery();
	})
	.controller("IMGController", function($scope, $rootScope, $http, fileUpload){
		$scope.bildStrukturen = [];
		$scope.meta = {}
		$scope.pollInterval = null;
		$scope.currentStage = null;
		$scope.commitTransaction = false;
		$scope.tSaveAs = "";
		$scope.axxL = {};

		// $scope.showDialog = false;
		// $scope.dcall = null;
		// $scope._dialogOK = function(){
		// 	$scope.dcall();
		// 	$scope.showDialog = false;
		// }
		$scope.axx = function(structName){
			if ($scope.hasaxx(structName)){
				 delete $scope.axxL[structName];
				 return;
			}
			$http.get("/bilder/axx?name=" + structName).success(function(data){
				$scope.axxL[structName] = data.content;
			}).error(function(error){
				console.warn(error);
			});
		}
		$scope.transactionDialog = function(title, desc, onok){
		 	$rootScope.$broadcast('transactionRequest', {
		 		title: title, desc: desc, onok: onok
		 	});
		}
		$scope.setTransaction = function(name){
			$rootScope.$broadcast('setTransaction', name);
		}
		$scope.axxclass = function(structName){
			if($scope.hasaxx(structName)) return "height:initial;";
		}
		$scope.hasaxx = function(structName){
			return $scope.axxL.hasOwnProperty(structName);
		}
		$scope.axxList = function(structName){
			return $scope.axxL[structName];
		}
		$scope.dialogCommitTransaction = function(){
			if($scope.tSaveAs == "") return;
			$scope.setTransaction("commit " + $scope.transactionName)
			$http({
				method: "POST",
				url: "/bilder/commit",
				data: JSON.stringify({
					"transaction_id" : $scope.transactionName,
					"prod" : $scope.tProd,
					"name" : $scope.tSaveAs
				})
			})
			.success(function(data){
				if (data.err){
					//$scope.setTransaction("commit failed: " + data.err);
					console.warn(data);
					return;
				}
				//$scope.setTransaction("commit ok ("+ data.name +")");
				$scope.commitTransaction = false;
				$scope.reload();
			})
			.error(function(data){
				console.warn(data);
				$scope.setTransaction("commit failed");	
			});

		}
		$scope.deltransaction = function(structName, dirInStruct){
			$scope.transactionDialog("TRANSACTION delete " + structName + " @ " + dirInStruct,
				"Das Segment wird gelöscht und Serverseitig neu gebaut. OK?", function(){
					$scope.setTransaction("del trans run");
					$http.post("/bilder/change", JSON.stringify({
						name: structName,
						rm: [dirInStruct]
					})).success(function(s){
						$scope.setTransaction("del trans job..");
						$scope.pollState();
					}).error(function(e){
						$scope.setTransaction("del fail");
						console.warn(e);
					});
				})
		}
		$scope.mrg = function(structName){
			$scope.transactionDialog("TRANSACTION merge " + structName + " nach " + $scope.meta.prod,
				"Dieses Element wird auf Production gemerged. Existierende Daten werden überschrieben. Struktur wird neu gebaut. OK?", function(){
					$scope.setTransaction("merge into prod");
					$http.post("/bilder/change", JSON.stringify({
						name: structName,
						mrg: $scope.meta.prod
					})).success(function(s){
						$scope.setTransaction("merging..");
						$scope.pollState();
					}).error(function(e){
						console.warn(e);
						$scope.setTransaction("merge failure");
					});
				})
		}
		$scope.pollState = function(){
			$scope.pollInterval = setInterval(function(){
				$http({
					method: "GET",
					url: "bilder/jobs"
				}).success(function(data){
					var keys = Object.keys(data);
					var job = data[keys[keys.length - 1]];
					$scope.transactionName = keys[keys.length - 1];
					$scope.tSaveAs = keys[keys.length -1];
						if (job["end"] !== undefined){
							if(job["end"] == 1){
								$scope.setTransaction("Merge/Delete OK");
								$scope.reload();
								clearInterval($scope.pollInterval);
								return;
							}
						} else {
							$scope.currentStage = job["currentstage"];
							$scope.setTransaction("at transaction: " + $scope.currentStage);
							if(job["stage" + $scope.currentStage]){
								if (job["stage" + $scope.currentStage]["exit"] != 0 && job["stage" + $scope.currentStage]["exit"] != undefined){
									$scope.setTransaction("fatal transaction error: "+ job["stage" + $scope.currentStage]["exit"]);
									clearInterval($scope.pollInterval);
								}
							}
							if (job["stage30"]){
								clearInterval($scope.pollInterval);
								$scope.commitTransaction = true;
							}
						}
				});
			}, 1300);	
		}
		$scope.reload = function(){
			$http({
				method: "GET",
				url: "/bilder/strukturen"
			}).success(function(data){
				$scope.bildStrukturen = data["strukturen"];
				$scope.meta = data["meta"];
				$scope.axxL = {};
			});
			// TODO default error handler
			// TODO HTTP DEBUG INFORMATION
		}	
		$scope.submit = function(){
			var f = document.getElementById('file').files[0];
			$scope.setTransaction("Upload..");	
			fileUpload.uploadFileToUrl(f, "/bilder/upload", function(suc){
				$scope.setTransaction("Upload Complete.");	
				$scope.pollState();
			}, function(fail){
				$scope.setTransaction("Upload failed.");
			});

			if (f === null){
				alert("no file duh");
			} 
		}
		$scope.setProd = function(structName){
			$scope.setTransaction("Change Prod -> " + structName);
			$http({
				method: "POST",
				url: "/bilder/prod",
				data: JSON.stringify({"prod" : structName})
			}).success(function(){
				$scope.setTransaction("Prod Change OK")
				$scope.reload();
			}).error(function(){
				$scope.setTransaction("transaction failed (404)")
			});
		}
		$scope.getBildStrukturen = function(){
			return $scope.bildStrukturen;
		}
		$scope.isProd = function(structName){
			return structName === $scope.meta["prod"]? "img-btn-active" : "img-btn-inactive"
		}
		$scope.isNotProd = function(structName){
			return structName !== $scope.meta["prod"]? "img-btn-active" : "img-btn-inactive"
		}
		// $scope.setTransaction = function(text){
		// 	document.getElementById("transaction_status").innerHTML = text;
		// 	$scope.addConsoleLine(text);
		// }
		// $scope.addConsoleLine = function(line){
		// 	var e =document.getElementById("console");
		// 	e.innerHTML = line + "<br/>" + e.innerHTML;
		// }
		$scope.reload();
	});