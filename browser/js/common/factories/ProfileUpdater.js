app.factory('ProfileUpdater', function ($http, Session, $rootScope) {

  //wrpper for $http that automatucally broadcasts an event (so we don't have to keep calling it. Sly and DRY)
  let http = function (method, url, body) {

    if($rootScope.guestMode) {
      console.info("Guest mode is active. Using local storage")
      return localAction((method + url), body);
    }

    return $http[method.toLowerCase()](url, body)
      .then(res => $rootScope.$broadcast('update-controller', res.data))
      .catch(err => $rootScope.$broadcast('update-controller', err.data, true))
  };
  let localAction = function (action, payload) {
    console.log("getting a profile from local storage")
    let profile = JSON.parse(localStorage.getItem('profile'));
    console.log("the profile we got", profile)
    switch (action){
      case 'PUT/api/user/tomatoMeter':
        profile.tomatoMeter.push(payload.tomato);
        if(payload.tomato.class === 'complete') profile.tomsToday++;
        break;
      case 'POST/api/user/tomatoMeter/archive':
        profile.archive.push({
          date: Sd.convertSd(profile.sunDial),
          tomatoMeter: profile.tomatoMeter
        });
        profile.tomatoMeter = [];
        profile.tomsToday = 0;
        profile.sunDial = Sd();
        break;
    }
    console.log("the new profile", profile);
    localStorage.setItem('profile', JSON.stringify(profile));
    $rootScope.$broadcast('update-controller', profile);
  }

  return {
    pushTomatoMeter: function (tomato) {
      // stuff goes here
      console.log("what is the session anywho ??", Session);
      return http('PUT', '/api/user/tomatoMeter', {
        user: Session.user && Session.user._id, //TODO: remove and use the user on the req.body from backend
        tomato,
      });
    },
    deleteTomatoMeter: function () {
      // deletes the current tomato meter of the day.
      return http('DELETE', '/api/user/tomatoMeter?user=' + Session.user._id);
      return $http.delete('/api/user/tomatoMeter?user=' + Session.user._id);
    },
    archiveTomatoMeter: function () {
      return http('POST', '/api/user/tomatoMeter/archive');
    },
  }
});
