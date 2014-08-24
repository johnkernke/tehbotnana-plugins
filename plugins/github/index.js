var logger = new (require('logger'))(app.config.log, 'GitHub'),
    githubapi = new (require('github'))({version:'3.0.0'});

module.exports = github;

function github() {
    var self = this;
    self.channels = {};
    self.cache = {};

    self.init = function () {
        for (channel in self.channels) {
            var _channel = self.channels[channel];

            _channel.repos.map(function (repo) {
                var _repo = repo.split('/');
                githubapi.events.getFromRepo({
                    user: _repo[0],
                    repo: _repo[1]
                }, self.handleRepo);
            });

            _channel.users.map(function (user) {
                
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
                if (event.id > self.cache[repo].lastId) {
                    events.push(event);
                }
            });

            events.reverse();

            for (event in events) {
                // app.irc.sendMessage()
            }
        }
    };

    self.handleUser = function (err, res) {

    };

    var channel_list = [];
    for (channel in app.config.channels) {
        if (app.config.channels[channel].github !== undefined) {
            var _cfg = app.config.channels[channel].github;
            channel_list.push(channel.toLowerCase());
            self.channels[channel.toLowerCase()] = {
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
        }
    }

    logger.notice('Enabled for: ' + channel_list.join(', '));
    delete channel_list;

    self.init();
}
