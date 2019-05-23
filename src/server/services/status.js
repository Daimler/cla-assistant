// services
const url = require('../services/url');
const github = require('../services/github');
const logger = require('../services/logger');

const log = (err, res, args) => {
    if (err) {
        logger.warn(new Error(err));
    }
    logger.info('Error: ', err, '; result: ', res, '; Args: ', args);
};

const getPR = async (args) => {
    try {
        return github.call({
            obj: 'pullRequests',
            fun: 'get',
            arg: {
                owner: args.owner,
                repo: args.repo,
                number: args.number,
                noCache: true
            },
            token: args.token
        });

    } catch (error) {
        logger.info(new Error(error).stack)
    }

};

const getStatuses = async (args) => {
    try {
        return github.call({
            obj: 'repos',
            fun: 'getStatuses',
            arg: {
                owner: args.owner,
                repo: args.repo,
                ref: args.sha,
                noCache: true
            },
            token: args.token
        });

    } catch (error) {
        logger.info(new Error(error).stack);
    }

};

const getCombinedStatus = async (args) => {
    try {
        return github.call({
            obj: 'repos',
            fun: 'getCombinedStatusForRef',
            arg: {
                owner: args.owner,
                repo: args.repo,
                ref: args.sha,
                noCache: true
            },
            token: args.token
        });
    } catch (error) {
        logger.info(new Error(error).stack);
    }


};

const createStatus = async (args, context, description, state, target_url) => {
    try {

        return github.call({
            obj: 'repos',
            fun: 'createStatus',
            arg: {
                owner: args.owner,
                repo: args.repo,
                sha: args.sha,
                state: state,
                description: description,
                target_url: target_url,
                context: context,
                noCache: true
            },
            token: args.token
        });

    } catch (error) {
        logger.warn('Error on Create Status, possible cause - wrong token, saved token does not have enough rights: ');

    }
};

const findStatusToBeChanged = async (args) => {
    try {

        const response = await getStatuses(args);
        // let statuses = '';
        const description = args.signed ? 'Contributor License Agreement is signed.' : 'Contributor License Agreement is not signed yet.';
        let status = {
            context: 'license/cla',
            description: description,
            state: args.signed ? 'success' : 'pending',
            target_url: url.claURL(args.owner, args.repo, args.number)
        };


        //statuses = JSON.parse(response);

        const statString = JSON.stringify(response);

        if (statString.includes('licence/cla') && status.state == 'success') { // temporary fix if both contexts are there
            let shouldBeChanged = false;
            response.some(function findClaStatusToChange(s) {
                if (s.context.match(/licence\/cla/g)) {
                    shouldBeChanged = s.state === 'pending';
                    return true;
                }
            });

            if (shouldBeChanged) {
                return status;
            }
        }
        if (response) {
            response.some(function findClaStatusToChange(s) {
                if (s.context.match(/license\/cla/g)) {
                    status = s.state !== status.state ? status : undefined;

                    return true;
                }
            });
        }
        return status;
    } catch (error) {
        logger.warn(error);

    }

}

const findClaStatus = async (args) => {
    try {
        const resp = await getCombinedStatus(args);
        let claStatus = null;
        resp.statuses.some(function (status) {
            if (status.context.match(/license\/cla/g)) {
                claStatus = status;
                return true;
            }
        });
        return claStatus;

    } catch (error) {
        logger.warn(error);

    }

}

const updateStatus = async (args) => {
    try {

        const status = await findStatusToBeChanged(args);

        if (!status) {
            return;
        }
        return createStatus(args, status.context, status.description, status.state, status.target_url);

    } catch (error) {
        logger.warn(new Error(`${error} with args: ${args}`).stack)

    }
}

const getPullRequestHeadShaIfNeeded = async (args) => {
    try {
        if (args.sha) {
            return args;
        }
        const pullRequest = await getPR(args);
        args.sha = pullRequest.head.sha;
        return args;
    } catch (error) {
        logger.info(new Error(error + 'Cannot get pull request head.').stack);
    }
};

const updateStatusIfNeeded = async (args, status, allowAbsent) => {

    if (!status) {
        return new Error('Status is required for updateStatusIfNeeded.');

    }
    try {
        const argsWithSha = await getPullRequestHeadShaIfNeeded(args);
        const claStatus = await findClaStatus(args);


        if (!claStatus || allowAbsent) {
            return createStatus(argsWithSha, status.context, status.description, status.state, status.target_url);
        }
        if (!claStatus || claStatus.state !== status.state || claStatus.description !== status.description || claStatus.target_url !== status.target_url) {
            return createStatus(argsWithSha, status.context, status.description, status.state, status.target_url);
        }
    } catch (error) {
        logger.warn(error);
    }
}

class StatusService {
    async update(args) {
        if (args && !args.sha) {
            try {
                const resp = await getPR(args);
                if (!resp || resp.message == 'Not found') {
                    return;
                }
                if (resp && resp.head) {
                    args.sha = resp.head.sha;
                    return updateStatus(args);
                } else if (args) {
                    return updateStatus(args);
                }
            } catch (error) {
                logger.warn(new Error(`${error} with args: ${args}`).stack);
            }

        }
        if (args.sha) {
            return updateStatus(args);
        }


    }
    async updateForNullCla(args) {
        let status = {
            context: 'license/cla',
            state: 'success',
            description: 'No Contributor License Agreement required.',
            target_url: null
        };
        return updateStatusIfNeeded(args, status, true);

    }
    async updateForClaNotRequired(args) {
        let status = {
            context: 'license/cla',
            state: 'success',
            description: 'All CLA requirements met.',
            target_url: null
        };
        return updateStatusIfNeeded(args, status, false);
    }

}

module.exports = new StatusService();