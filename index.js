var RSVP = require('rsvp');
var request = require('request');
var exec = require('exec');
var _ = require('underscore');

var BitbucketRest = function (opts) {
    this.baseUrl = opts.baseUrl;
    this.gitBaseUrl = opts.gitBaseUrl;
};

BitbucketRest.prototype.createProject = function (key, name) {
    var self = this;
    return new RSVP.Promise(function (resolve, reject) {
        var uri = self.baseUrl + '/rest/api/1.0/projects';
//        console.log("create project", uri);
        request.post(uri,function (err, res, data) {
            // succeed
            resolve(data);
        }).json({
                "key": key,
                "name": name,
                "description": "A Test Project."
            }).auth('admin', 'admin', true);
    });
};

BitbucketRest.prototype.createRepository = function (projectKey, repoName) {
    var self = this;
    return new RSVP.Promise(function (resolve, reject) {
        request.post(self.baseUrl + '/rest/api/1.0/projects/' + projectKey + '/repos',function (err, res, data) {
//            console.log("Created Repository", data);
            exec("rm -Rf src/test/repo; " +
                "tar -zxf src/test/repo.tgz src/test/repo; " +
                "cd src/test/repo ; " +
                "git remote rm origin ; " +
                "git remote add origin " + self.gitBaseUrl + "/scm/"+projectKey+"/"+repoName+".git ; " +
                "git push origin --all", function (err, out, code) {
                if (err instanceof Error)
                    throw err;
                process.stderr.write(err);
                process.stdout.write(out);
                resolve(); // done
            });


        }).json({
                "name": repoName,
                "scmId": "git",
                "forkable": true
            }).auth('admin', 'admin', true);
    });
};

BitbucketRest.prototype.fork = function (projectKey, repoName, forkName,  user) {
    var self = this;
    var user = user || {name : 'admin', password : 'admin'};
    return new RSVP.Promise(function (resolve, reject) {
        request.post(self.baseUrl + '/rest/api/1.0/projects/' + projectKey + '/repos/' + repoName,function (err, res, data) {
            if (! err) resolve();
            reject();
        }).json({"name":forkName, "slug": forkName, "project":{"key":projectKey}}).auth(user.name, user.password, true);
    });
};

BitbucketRest.prototype.createPrivateFork = function (projectKey, repoName, forkName,  user) {
    var self = this;
    var user = user || {name : 'admin', password : 'admin'};
    return new RSVP.Promise(function (resolve, reject) {
        request.post(self.baseUrl + '/rest/api/1.0/projects/' + projectKey + '/repos/' + repoName,function (err, res, data) {
            if (! err) resolve();
            reject();
        }).json({"name":forkName, "slug": forkName}).auth(user.name, user.password, true);
    });
};

BitbucketRest.prototype.deletePrivateFork = function (projKey, repo) {
    var self = this;
        return new RSVP.Promise(function (resolve, reject) {
            request.del(self.baseUrl + '/rest/api/1.0/projects/' + projKey + '/repos/' + repo,function (err, res, data) {
                console.log("Deleted Repository", projKey, repo);
                resolve(); // done
            }).auth('admin', 'admin', true);
        });
    };



BitbucketRest.prototype.getForks = function (projectKey, repoName) {
    var self = this;
    return new RSVP.Promise(function (resolve, reject) {
        request.get(self.baseUrl + '/rest/api/1.0/projects/' + projectKey + '/repos/' + repoName+'/forks',function (err, res, data) {
            if (err) reject();
            var forks = JSON.parse(data);
            resolve(forks);
        }).auth("admin", "admin", true);
    });
};

BitbucketRest.prototype.setRepositoryGroupPermissions = function (projKey, repoName, group) {
    var self = this;
    return new RSVP.Promise(function (resolve, reject) {
        request.put(self.baseUrl + '/rest/api/1.0/projects/' + projKey + '/repos/' + repoName + '/permissions/groups?permission=REPO_WRITE&name=' + group,function (err, res, data) {
            console.log("set write permissions for", projKey, repoName, group);
            if (!err) resolve();
            else reject();
        }).auth('admin', 'admin', true);
    });
};


BitbucketRest.prototype.createUser = function (user) {
    var self = this;
    return new RSVP.Promise(function (resolve, reject) {
//        console.log("creating user", user);
        request.post(self.baseUrl + '/rest/api/1.0/admin/users?' +
            'name=' + user.name +
            '&password=' + user.password +
            '&displayName=' + user.displayName +
            '&emailAddress=' + user.emailAddress,function (err, res, data) {
//            console.log("created user", data);
            if (!err) {
                resolve(); // done
            } else {
                console.log(err);
                reject();
            }
        }).json({}).auth("admin", "admin", true);
    });
};

/**
 *
 * @param user - user name
 * @param groups -  array of group names
 * @returns {RSVP.Promise}
 */
BitbucketRest.prototype.addUserGroups = function (user, groups) {
    var self = this;
    return new RSVP.Promise(function (resolve, reject) {
        request.post(self.baseUrl + '/rest/api/1.0/admin/users/add-groups',function (err, res, data) {
            console.log("group users", data);
            if (!err) {
                resolve(); // done
            } else {
                console.log(err);
                reject();
            }
        }).json({"user": user, "groups": groups}).auth("admin", "admin", true);
    });
};

BitbucketRest.prototype.createGroup = function (name){
    var self = this;
    return new RSVP.Promise( function(resolve, reject){
        request.post(self.baseUrl + '/rest/api/1.0/admin/groups?name=' + name, function (err, res, data){
            if (!err) {
                resolve(); // done
            } else {
                console.log(err);
                reject();
            }
        }).json({}).auth("admin", "admin", true);
    });
};

BitbucketRest.prototype.deleteGroup = function (name){
    var self = this;
    return new RSVP.Promise( function(resolve, reject){
        request.del(self.baseUrl + '/rest/api/1.0/admin/groups?name=' + name, function (err, res, data){
            if (!err) {
                resolve(); // done
            } else {
                console.log(err);
                reject();
            }
        }).json({}).auth("admin", "admin", true);
    });
};



BitbucketRest.prototype.deleteProject = function (projectKey) {
    var self = this;
        return new RSVP.Promise(function (resolve, reject) {
            console.log("Delete Project", projectKey);
            request.del(self.baseUrl + '/rest/api/1.0/projects/' + projectKey,function (err, res, data) {
                resolve(); //done
            }).auth('admin', 'admin', true);
        });
    };

BitbucketRest.prototype.deleteRepository = function (projKey, repo) {
    var self = this;
        return new RSVP.Promise(function (resolve, reject) {
            request.del(self.baseUrl + '/rest/api/1.0/projects/' + projKey + '/repos/' + repo,function (err, res, data) {
                console.log("Deleted Repository", projKey, repo);
                resolve(); // done
            }).auth('admin', 'admin', true);
        });
    };

BitbucketRest.prototype.approvePullRequest = function(projKey, repo, prId, userName) {
    var self = this;
    return new RSVP.Promise(function(resolve, reject){
        request.post(self.baseUrl+'/rest/api/1.0/projects/'+projKey+'/repos/'+repo+'/pull-requests/'+prId+'/approve', function(err, res, data){
            if (!err) {
                console.log("PR", prId, "approved by", userName);
                resolve();
                return;
            }
            console.log("approve PR error", err);
            reject();
        }).json({}).auth(userName, userName, true);
    });
};

BitbucketRest.prototype.needsWorkPullRequest = function (projKey, repo, prId, userName) {
    var self = this
    return new RSVP.Promise( function (resolve, reject) {
        request.put(self.baseUrl+'/rest/api/latest/projects/'+projKey+'/repos/'+repo+'/pull-requests/'+prId+'/participants/'+userName, function(err, resp, data) {
            if (!err) {
                resolve();
                return;
            }
            console.log('needs work update error', err)
            reject()
        }).json({"status": "NEEDS_WORK"}).auth(userName, userName, true)
    })
}


BitbucketRest.prototype.createPR = function (projKey, fromRepo, fromRef, toRepo, toRef, fromProjKeyOpt, asUserOpt) {
    asUserOpt = asUserOpt || "admin";
    var fromProjKey = fromProjKeyOpt || projKey;
    var self = this;
        return new RSVP.Promise(function (resolve, reject) {
            request.post(self.baseUrl+'/rest/api/1.0/projects/'+projKey+'/repos/'+toRepo+'/pull-requests',function (err, res, data) {
                console.log("PR created: ", data.id);
                if (!err) resolve(data);
                else reject();
            }).json({
                "title": "Test PR",
                "description": "test description",
                "state": "OPEN",
                "open": true,
                "closed": false,
                "fromRef": {
                    "id": fromRef,
                    "repository": {
                        "slug": fromRepo,
                        "name": null,
                        "project": {
                            "key": fromProjKey
                        }
                    }
                },
                "toRef": {
                    "id": toRef,
                    "repository": {
                        "slug": toRepo,
                        "name": null,
                        "project": {
                            "key": projKey
                        }
                    }
                },
                "reviewers": [ ]
            }).auth(asUserOpt, asUserOpt, true);

        });
    };

BitbucketRest.prototype.commentPullRequest = function (projKey, repoSlug, id, text, userName, userPassword) {
  var self = this;
  userName = userName || 'admin'
  userPassword = userPassword || 'admin'
  return new RSVP.Promise(function (resolve, reject) {
    console.log("comment PR", id, userName, userPassword)
    request.post(self.baseUrl+'/rest/api/1.0/projects/'+projKey+'/repos/'+repoSlug+'/pull-requests/'+id+'/comments',function (err, res, data) {
        if (!err && ! data.errors) {
            console.log("PR commented", data.id);
            resolve(data);
            return;
        }
        console.error(err, JSON.stringify(data));
        reject();
    }).json({text: text}).auth(userName, userPassword, true);
  })
}

BitbucketRest.prototype.updatePullRequest = function (id, version, projKey, fromRepo, reviewers, toRef, otherOpts) {
    var self = this;
        return new RSVP.Promise(function (resolve, reject) {
            var users = _.map(reviewers, function(name){
                                return {user:{name:name}};
                            });
            console.log("updating PR", id, "version", version, "users", users, "options", otherOpts );
            var data = {
                "title": otherOpts && otherOpts.title || "Test PR",
                "description": otherOpts && otherOpts.description || "test description",
                "reviewers": users,
                "version": version
            };
            if (toRef){
                data = _.extend(data, {toRef : toRef});
            }
            request.put(self.baseUrl+'/rest/api/1.0/projects/'+projKey+'/repos/'+fromRepo+'/pull-requests/'+id,function (err, res, data) {
                console.log("PR updated", data.id);
                if (!err && ! data.errors) {
                    console.log("PR updated", data.id);
                    resolve(data);
                    return;
                }
                console.error(err, JSON.stringify(data));
                reject();
            }).json(data).auth('admin', 'admin', true);

        });
    };


BitbucketRest.prototype.getPullRequests = function(prjKey, repoSlug, urlParams){
    var self = this;
    return new RSVP.Promise(function(resolve, reject){
        request.get(self.baseUrl+"/rest/api/1.0/projects/"+prjKey+"/repos/"+repoSlug+"/pull-requests?" + urlParams, function(err, res, data){
            var prJson = JSON.parse(data);
            resolve(prJson);
        }).auth("admin", "admin", true);

    });
};

BitbucketRest.prototype.getPullRequest = function(prjKey, repoSlug, id, action){
    var self = this;
    return new RSVP.Promise(function(resolve, reject){
        request.get(self.baseUrl+"/rest/api/1.0/projects/"+prjKey+"/repos/"+repoSlug+"/pull-requests/" + id + "/" + action, function(err, res, data){
            //console.log(data);
            var prJson = JSON.parse(data);
            resolve(prJson);
        }).auth("admin", "admin", true);

    });
};

BitbucketRest.prototype.setBranchPermissions = function(prjKey, repoSlug, ref, users, groups){
    users = users || [];
    groups = groups || [];
    var self = this;
    return new RSVP.Promise(function (resolve, reject){
        request.post(self.baseUrl+"/rest/branch-permissions/1.0/projects/"+prjKey+"/repos/"+repoSlug+"/restricted", function(err, res, data){
            console.log("Restricted branch", data);
            resolve();
        })
            .json({"type": "BRANCH",
                "value": ref,
                "users": users,
                "groups": groups})
            .auth("admin", "admin", true);
    });
};


BitbucketRest.prototype.getBranches = function(prjKey, repoSlug){
    var self = this;
    return new RSVP.Promise(function(resolve, reject){
        request.get(self.baseUrl+"/rest/api/1.0/projects/"+prjKey+"/repos/"+repoSlug+"/branches", function(err, res, data){
            var branches = JSON.parse(data);
            resolve(branches);
        }).auth("admin", "admin", true);
    });
};

BitbucketRest.prototype.sendBuildResult = function (latestFromChangeset, key) {
    key = key || "REPO-MASTER-" + new Date().getTime();
    var self = this;
    return new RSVP.Promise(function (resolve, reject) {
        request.post(self.baseUrl + "/rest/build-status/1.0/commits/" + latestFromChangeset,function (err, res, data) {
            console.log("build result sent");
            resolve();
        }).json({
                "state": "SUCCESSFUL",
                // this is just bla bla
                "key": key,
                "name": key+"-42",
                "url": "https://bamboo.example.com/browse/REPO-MASTER-42",
                "description": "Changes by John Doe"
            }).auth('admin', 'admin', true);
    });
};



module.exports = BitbucketRest;
