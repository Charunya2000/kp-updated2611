@Library(
        ['kpmc-devops-shared-library@feature/azure-migrationv3-java17',
         'kp-azure-jenkins-shared-libraries@release/v1.0.9',
         'kp-aks-jenkins-shared-libraries@feature/npm_error',
         'kp-jenkins-pipline-shared-libraries@feature/npm_error_sleep']
        ) _
        
def pipelineParams = [
//Begin user-specified params

envConvention: 'cabilling',
buildType: 'npm',
agentLabel: 'azure',
//Do not change line below. Abort Environments you do not wish to deploy to.

//deployEnv: 'pp',
deployEnv: 'prod',
smokeTesting: 'no'

]

azurePipeline([pipelineParams])
