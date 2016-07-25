app.config(function ($stateProvider) {
    $stateProvider.state('home', {
        url: '/',
        templateUrl: 'js/home/home.html',
        controller: 'HomeCtrl',
        resolve: {
            user: function (AuthService) {
                return AuthService.getLoggedInUser().then(user => user);
            },
            profile: function () {
                return {status: 100}
            }
        }
    });
});

app.controller('HomeCtrl', function ($scope, Store, profile, user) {

    console.log("the user: ", user);
    console.log("do we have the profile on the store? ", Store.profile);


    if (profile.status === 202) {
        Store.archiveTomsEaten();
    }

    $scope.isGuest = user.isGuest;

    let completed = user.tomsToday || 0;
    $scope.state = {
        timerRunning: false,
        timerPaused: false,
        onBreak: false,
        editing: false
    };
    let state = $scope.state; // for better readability.
    var timer;
    let titleCache;

    let getGoal = () => $scope.goal || "eating a tomato";

    $scope.getCompleted = () => completed;
    $scope.getTotal = Store.getTotalToms;

    // $scope.goal = "";


    $scope.time = "0:00";
    // $scope.state.onBreak = () => $scope.state.onBreak;
    $scope.tomatoMeter = user.tomatoMeter.length ? user.tomatoMeter : [{class: 'wait', text: "..."}];
    let activeIdx = ($scope.tomatoMeter.length - 1) || 0;

    $scope.startTimer = function (time = [25, 0]) {
        let activeTom = $scope.tomatoMeter[activeIdx];
        activeTom.class = 'active';
        activeTom.text = completed + 1;
        state.timerRunning = true;

        let intervalFn = function () {
            // assign scope and document title in one go
            document.title = "[" + ($scope.time = timer.getMins() + ":" + timer.getSecs()) + "] « " + getGoal();
            $scope.$digest();
            console.info("interval");
        };

        let completeFn = function () {
            if (document.hidden) new Notification("Pomodoro complete", {
                body: "Take a 5 minute break or select other options",
                icon: "/public/tomato.png"
            });
            $scope._markComplete();
            $scope.$digest();
        };
        timer = new Timer(time, completeFn, intervalFn);
        document.title = "[" + ($scope.time = "25:00") + "] « " + getGoal();
    };
    $scope.togglePause = function () {
        if (!timer)  return;

        timer.togglePause();
        state.timerPaused = !state.timerPaused;
        if (!titleCache) {
            titleCache = document.title;
            document.title = "▐▐ " + document.title;
        }
        else {
            document.title = titleCache;
            titleCache = null;
        }

    };

    $scope._markComplete = function () {
        let activeTom = $scope.tomatoMeter[activeIdx];
        activeTom.text = completed + 1;
        activeTom.class = 'complete';
        completed++;
        activeIdx++;
        $scope.tomatoMeter.push({class: 'wait', text: '...'})
        Store.updateProfile({
            tomsEaten: {
                today: Store.profile.tomsEaten.today + 1,
                tomatoMeter: $scope.tomatoMeter,
            }
        });
        // Store.profile.tomsEaten.today++;
    };

    $scope._markBreakStart = function () {
        let activeTom = $scope.tomatoMeter[activeIdx];
        activeTom.text = "#break#";
        activeTom.class = 'break';
        $scope.state.onBreak = true;
    };
    $scope._markBreakComplete = function () {
        let activeTom = $scope.tomatoMeter[activeIdx];
        activeIdx++;
        activeTom.class = "break complete";
        $scope.tomatoMeter.push({class: 'wait', text: '...'});
        $scope.state.onBreak = false;
        Store.updateProfile({
            tomsEaten: {
                tomatoMeter: $scope.tomatoMeter,
            }
        })
    };
    $scope._markFailed = function () {
        let activeTom = $scope.tomatoMeter[activeIdx];
        activeIdx++;
        activeTom.class = 'fail';
        activeTom.text = 'X';
        $scope.tomatoMeter.push({class: 'wait', text: '...'});
        Store.updateProfile({
            tomsEaten: {
                tomatoMeter: $scope.tomatoMeter,
            }
        })
    };
    $scope.archiveTomsEaten = Store.archiveTomsEaten

    let $inputGoal = $('input.goal'),
        $placeholder = $('#placeholder'),
        $goalInput = $('#goalInput');

    $scope.toggleEdit = () => {
        $placeholder.hide();
        $goalInput.show();
        setTimeout(() => document.getElementById('goalInput').focus(), 0);
    };
    $goalInput.blur(() => {
        if (!$scope.goal) {
            $goalInput.hide();
            $placeholder.show();
        }
    });
    $goalInput.keypress(e => {
        if (e.keyCode === 13) {
            console.log("finish edit");
            $inputGoal.blur();
        }
    })


    //tomato button controls
});
