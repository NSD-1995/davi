// Location is requested once, only after the user presses a punch button.
export function attendanceLocation(geolocation?: Geolocation): Promise<{latitude:number;longitude:number;accuracy:number}> {
  return new Promise((resolve,reject)=>{
    if(!geolocation)return reject(new Error('Location is unavailable. Use HTTPS and a device with location services, or request an attendance exception.'));
    geolocation.getCurrentPosition(position=>resolve({latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy}),error=>reject(new Error(error.code===1?'Location permission was denied. Enable location access or request an attendance exception.':error.code===3?'Location timed out. Try again outdoors or request an attendance exception.':'Device location is unavailable. Enable location services or request an attendance exception.')),{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  });
}
