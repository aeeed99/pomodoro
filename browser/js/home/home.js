app.config(function ($stateProvider) {
    $stateProvider.state('home', {
        url: '/',
        templateUrl: 'js/home/home.html',
        controller: 'HomeCtrl'
    });
});

app.controller('HomeCtrl', function ($scope) {

  let completed = 0;
  let activeIdx = 0;
  var timer;

  $scope.time = "0:00";
  $scope.tomatoMeter = [
    {class: 'wait', text: "..."},
  ];

  $scope.startTimer = function () {
    let activeTom = $scope.tomatoMeter[activeIdx];
    activeTom.class = 'active';
    activeTom.text = completed + 1;
    let intervalFn = function() {
      $scope.time = timer.getMins() + ":" + timer.getSecs();
      $scope.$digest();
      console.log("aue")
    };
    timer = new Timer([25,0], null, intervalFn);
    $scope.time = "25:00";
  };
  $scope._markComplete = function() {
    let activeTom = $scope.tomatoMeter[activeIdx];
    activeTom.text = completed + 1;
    activeTom.class = 'complete';
    completed++;
    activeIdx++;
    $scope.tomatoMeter.push({class: 'wait', text: '...'})
  };
  $scope._markBreakStart = function () {
    let activeTom = $scope.tomatoMeter[activeIdx];
    activeTom.text = "#break#";
    activeTom.class = 'break';
  };
  $scope._markBreakComplete = function () {
    let activeTom = $scope.tomatoMeter[activeIdx];
    activeIdx++;
    activeTom.class = "break complete";
    $scope.tomatoMeter.push({class: 'wait', text: '...'});
  };
  $scope._markFailed = function () {
    let activeTom = $scope.tomatoMeter[activeIdx];
    activeIdx++;
    activeTom.class = 'fail';
    activeTom.text = 'X';
    $scope.tomatoMeter.push({class: 'wait', text: '...'});
  }
});
