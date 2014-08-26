var logger = new (require('logger'))(app.config.log, 'GitHub'),
    githubapi = new (require('github'))({version:'3.0.0'});

module.exports = gh;

function gh() {
    var self = this;
    self.channels = {};
    self.cache = {};
    self.repos = {};
    // self.users = {};

    self.reposNum = 0;
    self.reposCount = 0;
    // self.usersNum = 0;
    // self.usersCount = 0;

    self.callApi = function () {
        for (var i in self.channels) {
            var channel = self.channels[i];

            channel.repos.map(function (repo) {
                var _repo = repo.split('/');
                self.reposCount++;
                githubapi.events.getFromRepo({
                    user: _repo[0],
                    repo: _repo[1]
                }, self.handleRepo);
            });

            // channel.users.map(function (user) {
            //     self.usersCount++;
            //     githubapi.events.getFromUser({
            //         user: user
            //     }, self.handleUser);
            // });
        }
    };

    self.handleRepo = function (error, res) {
        if (error) {
            logger.debug('Error with repo');
            return;
        }

        logger.debug('Request rate limit: ' + res.meta['x-ratelimit-remaining'] + '/' + res.meta['x-ratelimit-limit'] + ' (reset in ' + (res.meta['x-ratelimit-reset'] - Math.floor(new Date().getTime()/1000)) + 's)');

        var repo = res[0].repo.name,
            first_run = false;
        if (self.cache[repo] === undefined) {
            self.cache[repo] = {
                lastModified: new Date(0),
                lastId: 0
            };
            first_run = true;
        }

        if (!first_run && self.cache[repo].lastModified.getTime() < new Date(Date.parse(res.meta['last-modified'])).getTime()) {
            var events = [];
            res.map(function (event) {
                if (event.id > self.cache[repo].lastId) {
                    events.push(event);
                }
            });

            events.reverse();

            for (var i in events) {
                var event = events[i],
                    msg = '[GH ' + repo,
                    alert_type = '';

                if (event.type == 'PushEvent') {
                    alert_type = 'commit';
                    var branch = event.payload.ref.split('/');
                    msg += '@' + branch[branch.length - 1] + ' Commit] ';
                    msg += event.actor.login + ': ' + event.payload.commits[0].message.split(/\r?\n/)[0];
                    msg += ' https://github.com/' + repo + '/commit/' + event.payload.head.substr(0, 10);
                } else if (event.type == 'IssuesEvent') {
                    alert_type = 'issue';
                    msg += ' Issue ' + capitaliseFirstLetter(event.payload.action) + '] ';
                    msg += event.actor.login + ': ' + event.payload.issue.title;
                    msg += ' ' + event.payload.issue.html_url;
                } else if (event.type == 'IssueCommentEvent') {
                    alert_type = 'issue_comment';
                    msg += ' Issue Comment] ';
                    msg += event.actor.login + ': ' + event.payload.issue.title;
                    msg += ' ' + event.payload.issue.html_url;
                } else if (event.type == 'PullRequestEvent') {
                    alert_type = 'pull_request';
                    logger.debug('PullRequestEvent');
                } else if (event.type == 'ForkEvent' && event.payload.action == 'started') {
                    alert_type = 'fork';
                    msg += ' Forked] ';
                    msg += 'By: ' + event.actor.login;
                } else if (event.type == 'WatchEvent' && event.payload.action == 'started') {
                    alert_type = 'watch';
                    msg += ' Watched] ';
                    msg += 'By: ' + event.actor.login;
                } else {
                    logger.debug(repo + ' not notifying of event: ' + event.type);
                    continue;
                }

                for (var i in self.repos[repo]) {
                    var channel = self.repos[repo][i];
                    if (self.channels[channel].alerts[alert_type] === false) {
                        continue;
                    }

                    app.irc.sendMessage(channel, msg);
                }
            }
        }

        self.cache[repo] = {
            lastModified: new Date(Date.parse(res.meta['last-modified'])),
            lastId: res[0].id
        };

        self.reposCount--;
        self.handleTimer();
    };

    // self.handleUser = function (error, res) {
    //     if (error) {
    //         logger.debug('Error with user');
    //         return;
    //     }

    //     logger.debug('Request rate limit: ' + res.meta['x-ratelimit-remaining'] + '/' + res.meta['x-ratelimit-limit'] + ' (reset in ' + (res.meta['x-ratelimit-reset'] - Math.floor(new Date().getTime()/1000)) + 's)');

    //     var user = res.
    //     if (Self.cache[])

    //     self.usersCount--;
    //     self.handleTimer();
    // };

    self.handleTimer = function () {
        logger.debug('Repos Count: ' + self.reposCount);
        if (self.reposCount == 0) { // && self.usersCount == 0) {
            // we want to do the max amount of requests per hour (60), but we want a buffer
            // so calculate the time with "half" an extra repo
            var time = (self.reposNum + 0.5) * 60000; // (self.reposNum + self.usersNum + 1) * 60000
            logger.debug('Timer started at ' + (time / 1000) + ' seconds');
            setTimeout(self.callApi, time);
        }
    };

    var channel_list = [];
    for (var channel in app.config.channels) {
        var channel = channel.toLowerCase();
        if (app.config.channels[channel].github !== undefined) {
            var _cfg = app.config.channels[channel].github;
            channel_list.push(channel);
            self.channels[channel] = {
                alerts: {
                    commit: _cfg.alerts.commit || false,
                    issue: _cfg.alerts.issue || false,
                    issue_comment: _cfg.alerts.issue_comment || false,
                    pull_request: _cfg.alerts.pull_request || false,
                    fork: _cfg.alerts.fork || false,
                    watch: _cfg.alerts.watch || false
                },
                repos: _cfg.repos || []
                // users: _cfg.users || []
            };

            for (var i in self.channels[channel].repos) {
                self.reposNum++;
                var repo = self.channels[channel].repos[i];
                if (self.repos[repo] === undefined) {
                    self.repos[repo] = [channel];
                    continue;
                }

                if (self.repos[repo].indexOf(channel) > -1) {
                    continue;
                }

                self.repos[repo].push(channel);
            }

            // for (var i in self.channels[channel].users) {
            //     self.usersNum++;
            //     var user = self.channels[channel].users[i];
            //     if (self.users[user] === undefined) {
            //         self.users[user] = [channel];
            //         continue;
            //     }

            //     if (self.users[user].indexOf(channel) > -1) {
            //         continue;
            //     }

            //     self.users[user].push(channel);
            // }
        }
    }

    logger.notice('Enabled for: ' + channel_list.join(', '));
    delete channel_list;

    self.callApi();
}

// source: http://stackoverflow.com/a/1026087
// @todo find a nicer home for this
function capitaliseFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
