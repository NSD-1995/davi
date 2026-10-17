import {BadRequestException, ForbiddenException} from '@nestjs/common';

export const attendanceDefaults = {
  attendanceMode: null as 'ADMIN_ONLY'|'STAFF_SELF'|'BOTH'|null,
  locationVerificationEnabled: false,
  schoolLatitude: null as number|null,
  schoolLongitude: null as number|null,
  geofenceRadius: 100,
  maximumLocationAccuracy: 75,
  locationRetentionDays: 30,
  checkInTime: '09:00', checkOutTime: '16:00', lateGraceMinutes: 15,
  earlyDepartureRule: 'FLAG' as 'ALLOW'|'FLAG'|'REQUIRE_EXCEPTION',
  correctionRequestsEnabled: true, adminOverridesEnabled: true,
  designationOptionId: null as string|null,
  attendanceShifts: [] as any[], leavePolicies: [] as any[],
};
export const validTime = (value:unknown):value is string => typeof value==='string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export const clockMinutes = (time:string) => Number(time.slice(0,2))*60+Number(time.slice(3));

export function validateAttendancePolicy(policy:any) {
  if(policy.attendanceMode!==null&&!['ADMIN_ONLY','STAFF_SELF','BOTH'].includes(policy.attendanceMode))throw new BadRequestException('Choose Admin Only, Staff Self Check-in or Both.');
  for(const key of ['locationVerificationEnabled','correctionRequestsEnabled','adminOverridesEnabled'])if(typeof policy[key]!=='boolean')throw new BadRequestException('Invalid attendance setting: '+key);
  if(!validTime(policy.checkInTime)||!validTime(policy.checkOutTime)||policy.checkInTime>=policy.checkOutTime)throw new BadRequestException('Choose check-in and check-out times within the same school day.');
  if(!Number.isInteger(policy.lateGraceMinutes)||policy.lateGraceMinutes<0||policy.lateGraceMinutes>240)throw new BadRequestException('Late grace must be 0 to 240 minutes.');
  if(!['ALLOW','FLAG','REQUIRE_EXCEPTION'].includes(policy.earlyDepartureRule))throw new BadRequestException('Choose a valid early departure rule.');
  if(!Number.isFinite(policy.geofenceRadius)||policy.geofenceRadius<10||policy.geofenceRadius>10000||!Number.isFinite(policy.maximumLocationAccuracy)||policy.maximumLocationAccuracy<1||policy.maximumLocationAccuracy>1000)throw new BadRequestException('Invalid geofence radius or GPS accuracy threshold.');
  if(!Number.isInteger(policy.locationRetentionDays)||policy.locationRetentionDays<0||policy.locationRetentionDays>365)throw new BadRequestException('Location retention must be 0 to 365 days.');
  if(policy.locationVerificationEnabled&&(!Number.isFinite(policy.schoolLatitude)||Math.abs(policy.schoolLatitude)>90||!Number.isFinite(policy.schoolLongitude)||Math.abs(policy.schoolLongitude)>180))throw new BadRequestException('Set valid school coordinates before enabling location verification.');
}

export function effectiveAttendancePolicy(base:any,staff:any) {
  const department=staff.user?.profileOptions?.find((p:any)=>p.optionId===base.departmentOptionId)?.value;
  const shifts=base.attendanceShifts||[];
  const shift=shifts.find((s:any)=>s.staffIds?.includes(staff.id))||shifts.find((s:any)=>department&&s.departmentValues?.includes(department));
  const policy={...base,...(shift?.policy||{}),shiftName:shift?.name||'School schedule'};
  policy.attendanceMode=policy.attendanceMode||(policy.selfAttendanceEnabled?'BOTH':'ADMIN_ONLY');
  return policy;
}

export function haversineMetres(lat1:number,lon1:number,lat2:number,lon2:number) {
  const rad=(value:number)=>value*Math.PI/180;
  const a=Math.sin(rad(lat2-lat1)/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(rad(lon2-lon1)/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));
}

export function verifyAttendanceLocation(policy:any,input:any) {
  if(!policy.locationVerificationEnabled)return {locationVerified:false};
  const location=input?.location;
  if(!location||typeof location.latitude!=='number'||typeof location.longitude!=='number'||!Number.isFinite(location.latitude)||!Number.isFinite(location.longitude)||Math.abs(location.latitude)>90||Math.abs(location.longitude)>180||!Number.isFinite(location.accuracy)||location.accuracy<0)throw new BadRequestException('A valid device location and accuracy are required. Allow location access and try again, or request an exception.');
  if(location.accuracy>policy.maximumLocationAccuracy)throw new BadRequestException('GPS accuracy is insufficient. Move to an open area and retry, or request an exception.');
  const distance=haversineMetres(policy.schoolLatitude,policy.schoolLongitude,location.latitude,location.longitude);
  if(distance>policy.geofenceRadius)throw new ForbiddenException('You are outside the school attendance area. Check in on school premises or request an exception.');
  return {locationVerified:true,distance,accuracy:location.accuracy,latitude:location.latitude,longitude:location.longitude};
}
