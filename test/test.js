const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');
const { runCommand,readZip } = require('./helper');

describe('serverless package', function () {
  before(function () {
    this.timeout(60000);
    this.plugin_path = runCommand('npm',['link'])
    const homedir = require('os').homedir();
    this.test_path = path.join(homedir,'.serverless-test')
    fs.removeSync(this.test_path)
    fs.copySync('examples',this.test_path)
  })
  it('should bundle gem and configure layer ', function () {
    this.timeout(60000);
    let context_path = path.join(this.test_path,'basic')
    options= {cwd: context_path, encoding : 'utf8'}
    runCommand('npm',['link','serverless-ruby-layer'],options)
    runCommand('slss',['package'],options)
    let dot_serverless_path = path.join(context_path,'.serverless')
    let layer_zip_path = path.join(dot_serverless_path,'ruby_layer','gemLayer.zip')
    let function_zip_path = path.join(dot_serverless_path,'basic.zip')
    value = readZip(function_zip_path)
            .then(function(data){
              assert.deepEqual(['handler.rb'],data)
            })
    run_time ='2.5'
    value = readZip(layer_zip_path)
            .then(function(data){
              assert.deepEqual(['/','/bin/','/build_info/','/doc/','/extensions/',
                                '/gems/','/specifications/','/gems/httparty-0.18.1/',
                                '/gems/mime-types-3.3.1/','/gems/multi_xml-0.6.0/',
                                '/gems/mime-types-data-3.2020.0512/']
                                .map(data => 'ruby/'+run_time+'.0'+data).concat(['ruby/']).sort(),
                                data.sort())
              })
    let rawdata = fs.readFileSync(path.join(dot_serverless_path,'serverless-state.json'));
    let serverless_config = JSON.parse(rawdata);
    let layers = serverless_config['service']['layers']
    const {package, ...other_layer_conf} = layers['gem']
    assert.deepEqual(package['artifact'],path.resolve(layer_zip_path))
    assert.deepEqual(other_layer_conf,{ name: 'basic-dev-ruby-bundle', description: 'Ruby gem generated by serverless-ruby-bundler',
                             compatibleRuntimes: [ 'ruby'+run_time ]})
    assert.deepEqual(serverless_config['service']['artifact'],path.resolve(function_zip_path))
    cloud_resource = serverless_config['service']['provider']['compiledCloudFormationTemplate']['Resources']
    const {Content, ...others} = cloud_resource['GemLambdaLayer']['Properties']
    assert.deepEqual(others,{CompatibleRuntimes: ['ruby2.5'],
                              Description: 'Ruby gem generated by serverless-ruby-bundler',
                              LayerName: 'basic-dev-ruby-bundle'
                            })
    assert.deepEqual(cloud_resource['HelloLambdaFunction']['Properties']['Layers'],[ { Ref: 'GemLambdaLayer' } ])
    assert.deepEqual(cloud_resource['HelloLambdaFunction']['Properties']['Environment'],
                     {Variables: { GEM_PATH: '/opt/ruby/'+run_time+'.0'}})
  });
});
