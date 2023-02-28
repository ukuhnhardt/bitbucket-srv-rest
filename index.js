var RSVP = require('rsvp');
var request = require('request');
var child_process = require('child_process');
var Q = require('q');
var _ = require('underscore');

var BitbucketRest = function(opts) {
  this.baseUrl = opts.baseUrl;
  this.gitBaseUrl = opts.gitBaseUrl;
};

BitbucketRest.prototype.asUser = function (userName, password) {
  this.auth = {userName, password}
}

BitbucketRest.prototype.getAuth = function () {
  var userName = this.auth ? this.auth.userName : 'admin'
  var pw = this.auth ? this.auth.password : 'admin'
  // console.log('getAuth', [userName, pw])
  return [userName, pw]
}

BitbucketRest.prototype.createProject = function(key, name) {
  var self = this;
  return new RSVP.Promise(function(resolve, reject) {
    var uri = self.baseUrl + '/rest/api/1.0/projects';
    console.log('create project', uri);
    request.post(uri, function(err, res, data) {
      // succeed
      resolve(data);
    }).json({
      'key': key,
      'name': name,
      'description': `A Test Project named ${name}.`
    }).auth('admin', 'admin', true);
  });
};

BitbucketRest.prototype.getProject = function(projectKey) {
  const self = this
  return new RSVP.Promise((resolve, reject) => {
    request.get(self.baseUrl + '/rest/api/1.0/projects/' + projectKey + '?limit=1000', function(err, res, data) {
      if (!err) {
        resolve(JSON.parse(data))
      } else {
        reject()
      }
    }).auth('admin', 'admin', true)
  })
}


BitbucketRest.prototype.getRepos = function(projectKey) {
  const self = this
  return new RSVP.Promise((resolve, reject) => {
    request.get(self.baseUrl + '/rest/api/1.0/projects/' + projectKey + '/repos?limit=1000', function(err, res, data) {
      if (!err) {
        resolve(JSON.parse(data))
        return
      } else {
        reject()
      }
    }).auth('admin', 'admin', true)
  })
}

BitbucketRest.prototype.getRepo = function(projectKey, repoSlug) {
  const self = this
  return new RSVP.Promise((resolve, reject) => {
    request.get(self.baseUrl + '/rest/api/1.0/projects/' + projectKey + '/repos/' + repoSlug, function (err, res, data) {
      if (!err) {
        resolve(JSON.parse(data))
      } else {
        reject()
      }
    }).auth('admin', 'admin', true)
  })
}

BitbucketRest.prototype.createRepository = function(projectKey, repoName, repoZipPath) {
  var self = this;
  repoZipPath = repoZipPath || 'src/test/repo.tgz'
  const repoPath = repoZipPath.substr(0, repoZipPath.lastIndexOf('.'))
  return new RSVP.Promise(function(resolve, reject) {
    request.post(self.baseUrl + '/rest/api/1.0/projects/' + projectKey + '/repos', function(err, res, data) {
      // console.log('Created Repository', data);
      // console.log('Pushing data from', repoZipPath)
      child_process.exec(`rm -Rf ${repoPath} ; ` +
        `tar -zxf ${repoZipPath} ${repoPath} ; ` +
        `cd ${repoPath} ; ` +
        'git remote rm origin ; ' +
        'git remote add origin ' + self.gitBaseUrl + '/scm/' + projectKey + '/' + repoName + '.git ; ' +
        'git push origin --all',
        function(err, stdout, stderr) {
          if (err ){
            console.error(err);
            reject(err)
          }
          console.log({stdout, stderr})
          resolve(data); // done
        });
    }).json({
      'name': repoName,
      'scmId': 'git',
      'forkable': true
    }).auth('admin', 'admin', true);
  });
};

BitbucketRest.prototype.fork = function (projectKey, repoName, forkName, user) {
  var self = this;
  user = user || {
    name: 'admin',
    password: 'admin'
  };
  var deferred = Q.defer()
  console.log('forking', repoName, 'to', forkName)
  request.post(self.baseUrl + '/rest/api/1.0/projects/' + projectKey + '/repos/' + repoName, function (err, res, data) {
    if (!err) deferred.resolve(data)
    else deferred.reject(err)
  }).json({
    'name': forkName,
    'slug': forkName,
    'project': {
      'key': projectKey
    }
  }).auth(user.name, user.password, true);
  return deferred.promise;
};

BitbucketRest.prototype.createPrivateFork = function(projectKey, repoName, forkName, user) {
  var self = this;
  user = user || {
    name: 'admin',
    password: 'admin'
  };
  return new RSVP.Promise(function(resolve, reject) {
    request.post(self.baseUrl + '/rest/api/1.0/projects/' + projectKey + '/repos/' + repoName, function(err, res, data) {
      if (!err) resolve();
      reject();
    }).json({
      'name': forkName,
      'slug': forkName
    }).auth(user.name, user.password, true);
  });
};

BitbucketRest.prototype.deletePrivateFork = function(projKey, repo) {
  var self = this;
  return new RSVP.Promise(function(resolve, reject) {
    request.del(self.baseUrl + '/rest/api/1.0/projects/' + projKey + '/repos/' + repo, function(err, res, data) {
      console.log('Deleted Repository', projKey, repo);
      resolve(); // done
    }).auth('admin', 'admin', true);
  });
};


BitbucketRest.prototype.getForks = function(projectKey, repoName) {
  var self = this;
  return new RSVP.Promise(function(resolve, reject) {
    request.get(self.baseUrl + '/rest/api/1.0/projects/' + projectKey + '/repos/' + repoName + '/forks', function(err, res, data) {
      if (err) {
        reject();
        return
      }
      var forks = JSON.parse(data);
      resolve(forks);
    }).auth('admin', 'admin', true);
  });
};

BitbucketRest.prototype.searchGroups = function(projId = '', repoId = '', searchFilter = '') {
  const self = this
  const urlParams = ['permission.1=LICENSED_USER']
  urlParams.push(`permission.2=${repoId ? 'REPO_READ' : 'PROJECT_READ'}`)
  urlParams.push(`permission.2.${repoId ? 'repositoryId='+repoId : 'projectId=' + projId}`)
  urlParams.push(`filter=${searchFilter}`)
  urlParams.push('source.app.key=com.izymes.workzone')
  urlParams.push('start=0')
  const groupsUrl = self.baseUrl + '/rest/api/latest/groups?' + urlParams.join('&');
  console.log('searching groups', groupsUrl)
  return new Promise((resolve, reject) => request
    .get(groupsUrl, function(err, res, data) {
     if (!err) {
       resolve(JSON.parse(data))
     } else {
       reject(err)
     }
    })
    .auth('admin', 'admin', true)
    )
}

// LICENSED_USER, PROJECT_CREATE, ADMIN, SYS_ADMIN
BitbucketRest.prototype.setGlobalGroupPermission = function (permission = 'LICENSED_USER', group) {
  var self = this;
  return new Promise((resolve, reject) => {
    request.put(`${self.baseUrl}/rest/api/1.0/admin/permissions/groups?permission=${permission}&name=${group}`, function (err, res, data) {
      if (!err && res.statusCode < 400) {
        resolve()
      } else {
        console.error("setGlobalGroupPermission", err, data)
        reject(res.statusCode)
      }
    }).auth(...self.getAuth(), true)
  })

}

BitbucketRest.prototype.setRepositoryGroupPermissions = function(projKey, repoSlug, group, permission) {
  var self = this;
  permission = permission || 'REPO_WRITE'
  return new RSVP.Promise(function(resolve, reject) {
    request.put(self.baseUrl + '/rest/api/1.0/projects/' + projKey + '/repos/' + repoSlug + `/permissions/groups?permission=${permission}&name=${group}`, function(err, res, data) {
      console.log(`set repo permissions for group:`, projKey, repoSlug, group, permission);
      if (!err) resolve();
      else reject();
    }).auth('admin', 'admin', true);
  });
};

BitbucketRest.prototype.deleteRepositoryGroupPermissions = function(projKey, repoSlug, group) {
  var self = this;
  return new RSVP.Promise(function(resolve, reject) {
    request.del(self.baseUrl + '/rest/api/1.0/projects/' + projKey + '/repos/' + repoSlug + `/permissions/groups?name=${group}`, function(err, res, data) {
      console.log(`delete repo ${projKey}/${repoSlug} permissions for group ${group}`);
      if (!err) resolve();
      else reject();
    }).auth('admin', 'admin', true);
  });
};

BitbucketRest.prototype.setRepositoryUserPermissions = function(projKey, repoName, username, permission) {
  var self = this;
  permission = permission || 'REPO_WRITE'
  return new RSVP.Promise(function(resolve, reject) {
    request.put(self.baseUrl + '/rest/api/1.0/projects/' + projKey + '/repos/' + repoName + `/permissions/users?permission=${permission}&name=${username}`, function(err, res, data) {
      console.log('set repo write permissions for', projKey, repoName, username, permission);
      if (!err) resolve();
      else reject();
    }).auth('admin', 'admin', true);
  });
};


BitbucketRest.prototype.setProjectGroupPermissions = function(projKey, group, permission) {
  var self = this;
  permission = permission || 'PROJECT_WRITE'
  return new RSVP.Promise(function(resolve, reject) {
    request.put(self.baseUrl + '/rest/api/1.0/projects/' + projKey + `/permissions/groups?permission=${permission}&name=${group}`, function(err, res, data) {
      console.log('set project write permissions for', projKey, group, permission);
      if (!err) resolve();
      else reject();
    }).auth('admin', 'admin', true);
  });
};

BitbucketRest.prototype.setProjectUserPermissions = function(projKey, username, permission) {
  var self = this;
  permission = permission || 'PROJECT_WRITE'
  return new RSVP.Promise(function(resolve, reject) {
    request.put(self.baseUrl + '/rest/api/1.0/projects/' + projKey + `/permissions/users?permission=${permission}&name=${username}`, function(err, res, data) {
      console.log('set project write permissions for', projKey, username, permission);
      if (!err) resolve();
      else reject();
    }).auth('admin', 'admin', true);
  });
};


BitbucketRest.prototype.createUser = function(user) {
  var self = this;
  return new RSVP.Promise(function(resolve, reject) {
    //        console.log('creating user', user);
    request.post(self.baseUrl + '/rest/api/1.0/admin/users?' +
      'name=' + user.name +
      '&password=' + user.password +
      '&displayName=' + user.displayName +
      '&emailAddress=' + user.emailAddress,
      function(err, res, data) {
        //            console.log('created user', data);
        if (!err) {
          resolve(); // done
        } else {
          console.log(err);
          reject();
        }
      }).json({}).auth(...self.getAuth(), true);
  });
};

BitbucketRest.prototype.deleteUser = function(user) {
  var self = this;
  return new RSVP.Promise(function(resolve, reject) {
    //        console.log('creating user', user);
    request.del(self.baseUrl + '/rest/api/1.0/admin/users?' +
      'name=' + user.name,
      function(err, res, data) {
                   console.log('deleted user', data);
        if (!err) {
          resolve(); // done
        } else {
          console.log(err);
          reject();
        }
      }).json({}).auth('admin', 'admin', true);
  });
};


BitbucketRest.prototype.getUsers = function(filter) {
  const self = this
  return new Promise((resolve, reject) => {
    request.get(self.baseUrl + '/rest/api/1.0/admin/users?filter=' + filter,
      function(err, res, data) {
        if (!err) {
          resolve(data)
        } else {
          console.error(err)
          reject()
        }
      })
      .auth('admin', 'admin', true)
  })
}

/**
 *
 * @param user - user name
 * @param groups -  array of group names
 * @returns {RSVP.Promise}
 */
BitbucketRest.prototype.addUserGroups = function(user, groups) {
  var self = this;
  return new RSVP.Promise(function(resolve, reject) {
    // console.log(`adding ${user} to ${groups}`)
    request.post(self.baseUrl + '/rest/api/1.0/admin/users/add-groups', function(err, res, data) {
      if (!err) {
        // console.log(`added ${user} to ${groups}`)
        resolve(); // done
      } else {
        console.log(err);
        reject();
      }
    }).json({
      'user': user,
      'groups': groups
    }).auth(...self.getAuth(), true);
  });
};

BitbucketRest.prototype.createGroup = function(name) {
  var self = this
  return new RSVP.Promise(function(resolve, reject) {
    request.post(self.baseUrl + '/rest/api/1.0/admin/groups?name=' + name, function(err, res, data) {
      if (!err) {
        resolve() // done
      } else {
        console.log(err)
        reject()
      }
    }).json({}).auth(...self.getAuth(), true)
  });
};

BitbucketRest.prototype.deleteGroup = function(name) {
  var self = this;
  return new RSVP.Promise(function(resolve, reject) {
    request.del(self.baseUrl + '/rest/api/1.0/admin/groups?name=' + name, function(err, res, data) {
      if (!err) {
        resolve(); // done
      } else {
        console.log(err);
        reject();
      }
    }).json({}).auth('admin', 'admin', true);
  });
};

BitbucketRest.prototype.deleteProject = function(projectKey) {
  var self = this;
  return new RSVP.Promise(function(resolve, reject) {
    request.del(self.baseUrl + '/rest/api/1.0/projects/' + projectKey, function(err, res, data) {
      console.log('Deleted Project', projectKey, data);
      resolve(); //done
    }).auth('admin', 'admin', true);
  });
};

BitbucketRest.prototype.deleteRepository = function (projKey, repo) {
  var self = this;
  return new RSVP.Promise(function (resolve, reject) {
    request.del(self.baseUrl + '/rest/api/1.0/projects/' + projKey + '/repos/' + repo, function(err, res, data) {
      if (err) {
        console.error(err)
        reject(err)
        return
      }
      console.log('Deleted Repository', data);
      resolve() // done
    }).auth('admin', 'admin', true);
  })
}

BitbucketRest.prototype.moveRepository = function(projKey, repo, newProjKey, newRepoName) {
  var self = this;
  return new RSVP.Promise(function(resolve, reject) {
    request.put(self.baseUrl + '/rest/api/1.0/projects/' + projKey + '/repos/' + repo, function(err, res, data) {
      console.log('Moved Repository to', newProjKey, newRepoName);
      resolve(); // done
    }).json({
      'name': newRepoName,
      'project': {
        'key': newProjKey
      }
    }).auth('admin', 'admin', true);
  });
};

BitbucketRest.prototype.approvePullRequest = function(projKey, repo, prId, userName, pw) {
  var self = this;
  pw = pw || userName
  return new RSVP.Promise(function(resolve, reject) {
    request.post(self.baseUrl + '/rest/api/1.0/projects/' + projKey + '/repos/' + repo + '/pull-requests/' + prId + '/approve', function(err, res, data) {
      if (!err && !data.errors) {
        console.log('PR', prId, 'approved by', userName);
        resolve();
        return;
      }
      console.log('approve PR error', err, data.errors);
      reject();
    }).json({}).auth(userName, pw, true);
  });
};

BitbucketRest.prototype.needsWorkPullRequest = function(projKey, repo, prId, userName, userPwd) {
  userPwd = userPwd || userName
  var self = this
  return new RSVP.Promise(function(resolve, reject) {
    request.put(self.baseUrl + '/rest/api/latest/projects/' + projKey + '/repos/' + repo + '/pull-requests/' + prId + '/participants/' + userName, function(err, resp, data) {
      if (!err) {
        resolve();
        return;
      }
      console.log('needs work update error', err)
      reject()
    }).json({
      'status': 'NEEDS_WORK'
    }).auth(userName, userPwd, true)
  })
}


// this is done with Q promise
BitbucketRest.prototype.createPR = function (projKey, fromRepo, fromRef, toRepo, toRef, fromProjKeyOpt, asUserOpt, asUserPwdOpt, options) {
  var title = options && options.title ?
    options.title : 'Test PR'
  var desc = options && options.desc ?
    options.desc : 'Test description'
  var reviewers = options && options.reviewers ? 
    options.reviewers : []
  asUserOpt = asUserOpt || 'admin'
  asUserPwdOpt = asUserPwdOpt || asUserOpt
  var fromProjKey = fromProjKeyOpt || projKey
  var self = this;
  var deferred = Q.defer();
  request.post(self.baseUrl + '/rest/api/1.0/projects/' + projKey + '/repos/' + toRepo + '/pull-requests', function (err, res, data) {
    if (err) {
      console.log('error creating PR', err)
      deferred.reject(err)
    } else if (data && data.id) {
      deferred.resolve(data)
    } else {
      console.log('problem creating PR', data)
      deferred.reject(data)
    }
  }).json({
    'title': title,
    'description': desc,
    'state': 'OPEN',
    'open': true,
    'closed': false,
    'fromRef': {
      'id': fromRef,
      'repository': {
        'slug': fromRepo,
        'name': null,
        'project': {
          'key': fromProjKey
        }
      }
    },
    'toRef': {
      'id': toRef,
      'repository': {
        'slug': toRepo,
        'name': null,
        'project': {
          'key': projKey
        }
      }
    },
    'reviewers': reviewers
  }).auth(asUserOpt, asUserPwdOpt, true);


  return deferred.promise
};

BitbucketRest.prototype.commentPullRequest = function(projKey, repoSlug, id, text, userName, userPassword, severity) {
  var self = this;
  userName = userName || 'admin'
  userPassword = userPassword || 'admin'
  severity = severity || "NORMAL"
  return new RSVP.Promise(function(resolve, reject) {
    console.log('comment PR', id, "by user", userName, userPassword)
    request.post(self.baseUrl + '/rest/api/1.0/projects/' + projKey + '/repos/' + repoSlug + '/pull-requests/' + id + '/comments', function(err, res, data) {
      if (!err && !data.errors) {
        const {id, severity, state} = data
        console.log('PR commented resp', {id, severity, state});
        resolve(data);
        return;
      }
      console.error(err, JSON.stringify(data));
      reject();
    }).json({
      text: text,
      severity: severity
    }).auth(userName, userPassword, true);
  })
}

BitbucketRest.prototype.updatePullRequestComment = function (commentId, version, pullRequestId, projKey,
                                                             repoSlug, severity, state, userName, userPassword) {
  var self = this;
  userName = userName || 'admin'
  userPassword = userPassword || 'admin'
  severity = severity || "NORMAL"
  state = state || "OPEN"
  return new Promise((resolve, reject) => {
    request.put(`${self.baseUrl}/rest/api/1.0/projects/${projKey}/repos/${repoSlug}/pull-requests/${pullRequestId}/comments/${commentId}`, function(err, res, data) {
      if (!err && !data.errors) {
        const {id, severity, state} = data
        console.log(`PR ${pullRequestId} comment updated resp`, {id, severity, state, userName})
        resolve(data)
        return
      }
      console.error(err, JSON.stringify(data))
      reject()
    }).json({
      severity, state, version
    }).auth(userName, userPassword, true)
  })
}

BitbucketRest.prototype.updatePullRequest = function(id, version, projKey, fromRepo, reviewers, toRef, otherOpts) {
  var self = this;
  return new RSVP.Promise(function(resolve, reject) {
    var users = _.map(reviewers, function(name) {
      return {
        user: {
          name: name
        }
      };
    });
    console.log('updating PR', id, 'version', version, 'users', users, 'options', otherOpts);
    var data = {
      'title': otherOpts && otherOpts.title || 'Test PR',
      'description': otherOpts && otherOpts.description || 'test description',
      'reviewers': users,
      'version': version
    };
    if (toRef) {
      data = _.extend(data, {
        toRef: toRef
      });
    }
    request.put(self.baseUrl + '/rest/api/1.0/projects/' + projKey + '/repos/' + fromRepo + '/pull-requests/' + id, function(err, res, data) {
      console.log('PR updated', data.id);
      if (!err && !data.errors) {
        console.log('PR updated', data.id);
        resolve(data);
        return;
      }
      console.error(err, JSON.stringify(data));
      reject();
    }).json(data).auth('admin', 'admin', true);

  });
};


BitbucketRest.prototype.getPullRequests = function(prjKey, repoSlug, urlParams) {
  var self = this;
  return new RSVP.Promise(function(resolve, reject) {
    request.get(self.baseUrl + '/rest/api/1.0/projects/' + prjKey + '/repos/' + repoSlug + '/pull-requests?' + urlParams, function(err, res, data) {
      var prJson = JSON.parse(data);
      resolve(prJson);
    }).auth('admin', 'admin', true);

  });
};

BitbucketRest.prototype.getPullRequest = function(prjKey, repoSlug, id, action) {
  var self = this;
  action = action || ''
  return new RSVP.Promise(function(resolve, reject) {
    request.get(self.baseUrl + '/rest/api/1.0/projects/' + prjKey + '/repos/' + repoSlug + '/pull-requests/' + id + '/' + action, function(err, res, data) {
      //console.log(data);
      var prJson = JSON.parse(data);
      resolve(prJson);
    }).auth('admin', 'admin', true);

  });
};

BitbucketRest.prototype.getPullRequestStatus = function(prjKey, repoSlug, id, asUser) {
  var self = this;
  var action = 'merge'
  asUser = asUser || ['admin', 'admin']
  return new RSVP.Promise(function(resolve, reject) {
    request.get(self.baseUrl + '/rest/api/1.0/projects/' + prjKey + '/repos/' + repoSlug + '/pull-requests/' + id + '/' + action, function(err, res, data) {
      //console.log(data);
      var prJson = JSON.parse(data);
      resolve(prJson);
    }).auth(...asUser, true);

  });
};

BitbucketRest.prototype.mergePullRequest = function(prjKey, repoSlug, id, version, userName, pwd) {
  var self = this;
  userName = userName || 'admin'
  pwd = pwd || 'admin'
  return new RSVP.Promise(function(resolve, reject) {
    const url = `${self.baseUrl}/rest/api/1.0/projects/${prjKey}/repos/${repoSlug}/pull-requests/${id}/merge?version=${version}`;
    const headers = {
      'X-Atlassian-Token': 'no-check'
    }
    request.post({
      url,
      headers
    }, function (err, res, data) {
      // console.log('merge result', data);
      try {
        if (err) {
          throw err
        }
        var prJson = JSON.parse(data);
        resolve(prJson)
      } catch (exception) {
        console.error('merge ', exception, data)
        reject(exception, data)
      }
    }).auth(userName, pwd, true);

  });
};



BitbucketRest.prototype.setBranchPermissions = function(prjKey, repoSlug, ref, users, groups) {
  users = users || [];
  groups = groups || [];
  var self = this;
  return new RSVP.Promise(function(resolve, reject) {
    request.post(self.baseUrl + '/rest/branch-permissions/1.0/projects/' + prjKey + '/repos/' + repoSlug + '/restricted', function(err, res, data) {
        console.log('Restricted branch', data);
        resolve();
      })
      .json({
        'type': 'BRANCH',
        'value': ref,
        'users': users,
        'groups': groups
      })
      .auth('admin', 'admin', true);
  });
};


BitbucketRest.prototype.getBranches = function(prjKey, repoSlug) {
  var self = this;
  return new RSVP.Promise(function(resolve, reject) {
    request.get(self.baseUrl + '/rest/api/1.0/projects/' + prjKey + '/repos/' + repoSlug + '/branches', function(err, res, data) {
      var branches = JSON.parse(data);
      resolve(branches);
    }).auth('admin', 'admin', true);
  });
};

// result = SUCCESSFUL or FAILED or INPROGRESS
BitbucketRest.prototype.sendBuildResult = function(latestFromChangeset, key, result) {
  key = key || 'REPO-MASTER-' + new Date().getTime();
  result = result || 'SUCCESSFUL'
  var self = this;
  return new RSVP.Promise(function(resolve, reject) {
    request.post(self.baseUrl + '/rest/build-status/1.0/commits/' + latestFromChangeset, function(err, res, data) {
      console.log('build result sent', result);
      resolve();
    }).json({
      'state': result,
      // this is just bla bla
      'key': key,
      'name': key + '-42',
      'url': 'https://bamboo.example.com/browse/REPO-MASTER-42',
      'description': 'Changes by John Doe'
    }).auth(...self.getAuth(), true);
  });
};

// result = SUCCESSFUL or FAILED or INPROGRESS
BitbucketRest.prototype.sendBambooBuildResult = function(projKey, repoSlug, ref, latestFromChangeset, key, result) {
  key = key || 'REPO-MASTER-' + new Date().getTime();
  result = result || 'SUCCESSFUL'
  var self = this;
  let data = !!ref ? {ref: ref} : {}
  return new RSVP.Promise(function(resolve, reject) {
    request.post(self.baseUrl + `/rest/api/1.0/projects/${projKey}/repos/${repoSlug}/commits/${latestFromChangeset}/builds` , function(err, res, data) {
      console.log('build result sent', result);
      resolve();
    }).json({...data,
      'state': result,
      // this is just bla bla
      'key': key,
      'name': key + '-42',
      'ref': ref,
      'url': 'https://bamboo.example.com/browse/REPO-MASTER-42',
      'description': 'Changes by John Doe'
    }).auth(...self.getAuth(), true);
  });
};

BitbucketRest.prototype.setReviewerGroup = function(projKey, repoSlug = '', reviewerGroup ) {
  var self = this
  const url = self.baseUrl + `/rest/api/latest/projects/${projKey}${repoSlug ? '/repos/' + repoSlug : ''}/settings/reviewer-groups`
  return new Promise((resolve, reject) => request
    .post(url, function(err, res, data){
      if (!err) 
        resolve(data)
      else
        reject(err)
    })
    .json(reviewerGroup)
    .auth('admin', 'admin', true)
  )
}

BitbucketRest.prototype.getReviewerGroups = function(projKey, repoSlug = '' ) {
  var self = this
  const url = self.baseUrl + `/rest/api/latest/projects/${projKey}${repoSlug ? '/repos/' + repoSlug : ''}/settings/reviewer-groups`
  return new Promise((resolve, reject) => request
    .get(url, function(err, res, data){
      if (!err) 
        resolve(data)
      else
        reject(err)
    })
    .auth('admin', 'admin', true)
  )
}

BitbucketRest.prototype.pullRequestSettings = function(projKey, repo, settings) {
  var self = this
  return new RSVP.Promise(function(resolve, reject) {
    request.post(self.baseUrl + '/rest/api/latest/projects/' + projKey + '/repos/' + repo + '/settings/pull-requests', function(err, resp, data) {
      if (!err) {
        resolve(data)
        return;
      }
      console.error('pull-requests/settings ', err)
      reject()
    }).json(settings).auth('admin', 'admin', true)
  })
}

BitbucketRest.prototype.getPullRequestSettings = function(projKey, repo) {
  var self = this
  return new RSVP.Promise(function(resolve, reject) {
    request.get(self.baseUrl + '/rest/api/latest/projects/' + projKey + '/repos/' + repo + '/settings/pull-requests', function(err, resp, data) {
      if (!err) {
        resolve(data)
        return;
      }
      console.error('pull-requests/settings ', err)
      reject()
    }).auth('admin', 'admin', true)
  })
}

BitbucketRest.prototype.getCommits = function(projKey, repo) {
  var self = this
  return new RSVP.Promise(function(resolve, reject) {
    request.get(self.baseUrl + '/rest/api/latest/projects/' + projKey + '/repos/' + repo + '/commits', function(err, resp, data) {
      if (!err) {
        //console.log('commites raw', data)
        resolve(JSON.parse(data))
        return
      }
      console.error('repo commits', err)
      reject()
    }).auth('admin', 'admin', true)
  })
}

BitbucketRest.prototype.addComment = function(projKey, repoSlug, prId, comment) {
  var self = this
  return new RSVP.Promise(function(resolve, reject) {
    request.post(self.baseUrl + '/rest/api/latest/projects/' + projKey + '/repos/' + repoSlug + '/pull-requests/' + prId + '/comments', function(err, resp, data) {
      //console.log('add comment resp', resp)
      if (!err) {
        // console.log('comment added', data)
        resolve(data)
        return
      }
      console.error('add comment', err)
      reject()
    }).json({
      'text': comment
    }).auth('admin', 'admin', true)
  })
}

BitbucketRest.prototype.addTask = function(anchorId, taskText) {
  var self = this
  return new RSVP.Promise(function(resolve, reject) {
    request.post(self.baseUrl + '/rest/api/latest/tasks', function(err, resp, data) {
        if (!err) {
          // console.log('added task', data)
          resolve(data)
          return
        }
        console.error('add task', err)
        reject()
      }).json({
        'anchor': {
          'id': anchorId,
          'type': 'COMMENT'
        },
        'text': taskText
      })
      .auth('admin', 'admin', true)
  })
}

BitbucketRest.prototype.completeTask = function(taskId) {
  var self = this
  return new RSVP.Promise(function(resolve, reject) {
    request.put(self.baseUrl + '/rest/api/latest/tasks/' + taskId, function(err, resp, data) {
        if (!err) {
          // console.log('complete task', data)
          resolve(data)
          return
        }
        console.error('complete task', err)
        reject()
      }).json({
        'id': taskId,
        'state': 'RESOLVED'
      })
      .auth('admin', 'admin', true)
  })
}

BitbucketRest.prototype.setMailServer = function(hostname, port, senderddress) {
  const self = this
  return new Promise((resolve, reject) => {
    request.put(`${self.baseUrl}/rest/api/1.0/admin/mail-server`, (err, resp, data) => {
      if (!err && resp.statusCode < 400) {
        // console.log('created bitbucket mail server', data)
        resolve(data)
        return
      }
      reject(resp.statusCode, err)
    })
    .json({hostname, port, "sender-address": senderddress})
    .auth('admin', 'admin', true)
  })
}

BitbucketRest.prototype.deleteMailServer = function() {
  const self = this
  return new Promise((resolve, reject) => {
    request.del(`${self.baseUrl}/rest/api/1.0/admin/mail-server`, (err, resp, data) => {
      if (!err && resp.statusCode < 400) {
        // console.log('deleted bitbucket mail server')
        resolve()
        return
      }
      reject(resp.statusCode, err)
    })
    .auth('admin', 'admin', true)
  })
}

BitbucketRest.prototype.getUser = function(username) {
  const self = this
  return new Promise((resolve, reject) => {
    request.get(`${self.baseUrl}/rest/api/1.0/users/${username}`, (err, resp, data) => {
      if (!err && resp.statusCode < 400) {
        // console.log('user details', data)
        resolve(JSON.parse(data))
        return
      }
      reject(resp.statusCode, err)
    })
    .auth('admin', 'admin', true)
  })
}


module.exports = BitbucketRest
