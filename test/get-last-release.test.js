import test from 'ava';
import {stub} from 'sinon';
import getLastRelease from '../lib/get-last-release';
import {gitRepo, gitCommits, gitTagVersion, gitCheckout} from './helpers/git-utils';

// Save the current working diretory
const cwd = process.cwd();

test.beforeEach(t => {
  // Stub the logger functions
  t.context.log = stub();
  t.context.logger = {log: t.context.log};
});

test.afterEach.always(() => {
  // Restore the current working directory
  process.chdir(cwd);
});

test.serial('Get the highest valid tag', async t => {
  // Create a git repository, set the current working directory at the root of the repo
  await gitRepo();
  // Create some commits and tags
  await gitCommits(['First']);
  await gitTagVersion('foo');
  const commits = await gitCommits(['Second']);
  await gitTagVersion('v2.0.0');
  await gitCommits(['Third']);
  await gitTagVersion('v1.0.0');
  await gitCommits(['Fourth']);
  await gitTagVersion('v3.0');

  const result = await getLastRelease(`v\${version}`, t.context.logger);

  t.deepEqual(result, {gitHead: commits[0].hash, gitTag: 'v2.0.0', version: '2.0.0'});
  t.deepEqual(t.context.log.args[0], ['Found git tag %s associated with version %s', 'v2.0.0', '2.0.0']);
});

test.serial('Get the highest tag in the history of the current branch', async t => {
  // Create a git repository, set the current working directory at the root of the repo
  await gitRepo();
  // Add commit to the master branch
  await gitCommits(['First']);
  // Create the tag corresponding to version 1.0.0
  // Create the new branch 'other-branch' from master
  await gitCheckout('other-branch');
  // Add commit to the 'other-branch' branch
  await gitCommits(['Second']);
  // Create the tag corresponding to version 3.0.0
  await gitTagVersion('v3.0.0');
  // Checkout master
  await gitCheckout('master', false);
  // Add another commit to the master branch
  const commits = await gitCommits(['Third']);
  // Create the tag corresponding to version 2.0.0
  await gitTagVersion('v2.0.0');

  const result = await getLastRelease(`v\${version}`, t.context.logger);

  t.deepEqual(result, {gitHead: commits[0].hash, gitTag: 'v2.0.0', version: '2.0.0'});
});

test.serial('Return empty object if no valid tag is found', async t => {
  // Create a git repository, set the current working directory at the root of the repo
  await gitRepo();
  // Create some commits and tags
  await gitCommits(['First']);
  await gitTagVersion('foo');
  await gitCommits(['Second']);
  await gitTagVersion('v2.0.x');
  await gitCommits(['Third']);
  await gitTagVersion('v3.0');

  const result = await getLastRelease(`v\${version}`, t.context.logger);

  t.deepEqual(result, {});
  t.is(t.context.log.args[0][0], 'No git tag version found');
});

test.serial('Get the highest valid tag corresponding to the "tagFormat"', async t => {
  // Create a git repository, set the current working directory at the root of the repo
  await gitRepo();
  // Create some commits and tags
  const [{hash: gitHead}] = await gitCommits(['First']);

  await gitTagVersion('1.0.0');
  t.deepEqual(await getLastRelease(`\${version}`, t.context.logger), {
    gitHead,
    gitTag: '1.0.0',
    version: '1.0.0',
  });

  await gitTagVersion('foo-1.0.0-bar');
  t.deepEqual(await getLastRelease(`foo-\${version}-bar`, t.context.logger), {
    gitHead,
    gitTag: 'foo-1.0.0-bar',
    version: '1.0.0',
  });

  await gitTagVersion('foo-v1.0.0-bar');
  t.deepEqual(await getLastRelease(`foo-v\${version}-bar`, t.context.logger), {
    gitHead,
    gitTag: 'foo-v1.0.0-bar',
    version: '1.0.0',
  });

  await gitTagVersion('(.+)/1.0.0/(a-z)');
  t.deepEqual(await getLastRelease(`(.+)/\${version}/(a-z)`, t.context.logger), {
    gitHead,
    gitTag: '(.+)/1.0.0/(a-z)',
    version: '1.0.0',
  });

  await gitTagVersion('2.0.0-1.0.0-bar.1');
  t.deepEqual(await getLastRelease(`2.0.0-\${version}-bar.1`, t.context.logger), {
    gitHead,
    gitTag: '2.0.0-1.0.0-bar.1',
    version: '1.0.0',
  });
});
