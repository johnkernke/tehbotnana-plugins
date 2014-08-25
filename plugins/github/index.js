var logger = new (require('logger'))(app.config.log, 'GitHub'),
    githubapi = new (require('github'))({version:'3.0.0'});

module.exports = github;

function github() {
    var self = this;
    self.channels = {};
    self.cache = {};
    self.repos = {};
    self.users = {};

    self.init = function () {
        for (var i in self.channels) {
            var channel = self.channels[i];

            channel.repos.map(function (repo) {
                var _repo = repo.split('/');
                githubapi.events.getFromRepo({
                    user: _repo[0],
                    repo: _repo[1]
                }, self.handleRepo);
            });

            channel.users.map(function (user) {
                
            });
        }
    };

    self.handleRepo = function(error, res) {
        if (error) {
            logger.debug('Error with repo');
            return;
        }

        logger.debug('Request rate limit: ' + res.meta['x-ratelimit-remaining'] + '/' + res.meta['x-ratelimit-limit'] + ' (reset in ' + (res.meta['x-ratelimit-reset'] - Math.floor(new Date().getTime()/1000)) + 's)');

        var repo = res[0].repo.name;
        if (self.cache[repo] === undefined) {
            self.cache[repo] = {
                lastModified: new Date(Date.parse(res.meta['last-modified'])),
                lastId: res[0].id-1
            };
            // return;
        }

        if (true||self.cache[repo].lastModified.getTime > new Date(Date.parse(res.meta['last-modified'])).getTime()) {
            var events = [];
            res.map(function (event) {
                // if (event.id > self.cache[repo].lastId) {
                    events.push(event);
                // }
            });

            for (var i in events) {
                var event = events[i],
                    msg = '[GH ' + repo;

                // @todo add checking of config if event type is enabled
                if (event.type == 'PushEvent') {
                    var branch = event.payload.ref.split('/');
                    msg += '@' + branch[branch.length - 1] + ' Push] ';
                    msg += event.actor.login + ': ' + event.payload.commits[0].message.split(/\r?\n/)[0];
                    msg += ' https://github.com/' + repo + '/commit/' + event.payload.head.substr(0, 10);
                } else if (event.type == 'IssuesEvent') {
                    msg += ' Issue ' + capitaliseFirstLetter(event.payload.action) + '] ';
                    msg += event.actor.login + ': ' + event.payload.issue.title;
                    msg += ' ' + event.payload.issue.html_url;
                } else if (event.type == 'IssueCommentEvent') {
                    msg += ' Issue Comment] ';
                    msg += event.actor.login + ': ' + event.payload.issue.title;
                    msg += ' ' + event.payload.issue.html_url;
                } else if (event.type == 'PullRequestEvent') {
                    logger.debug('PullRequestEvent');
                } else if (event.type == 'ForkEvent') {
                    logger.debug('ForkEvent');
                } else if (event.type == 'WatchEvent') {
                    logger.debug('WatchEvent');
                } else if (event.type == 'FollowEvent') { // check me
                    logger.debug('FollowEvent');
                } else {
                    logger.debug(repo + ' not notifying of event: ' + event.type);
                    continue;
                }

                for (var i in self.repos[repo]) {
                    app.irc.sendMessage(self.repos[repo][i], msg);
                }
            }
        }
    };

    self.handleUser = function (err, res) {

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
                    follow: _cfg.alerts.follow || false,
                    fork: _cfg.alerts.fork || false,
                    watch: _cfg.alerts.watch || false
                },
                repos: _cfg.repos || [],
                users: _cfg.users || []
            };

            for (var i in self.channels[channel].repos) {
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

            for (var i in self.channels[channel].users) {
                var user = self.channels[channel].users[i];
                if (self.users[user] === undefined) {
                    self.users[user] = [channel];
                    continue;
                }

                if (self.users[user].indexOf(channel) > -1) {
                    continue;
                }

                self.users[user].push(channel);
            }
        }
    }

    logger.notice('Enabled for: ' + channel_list.join(', '));
    delete channel_list;

    self.init();
}

// source: http://stackoverflow.com/a/1026087
// @todo find a nicer home for this
function capitaliseFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
