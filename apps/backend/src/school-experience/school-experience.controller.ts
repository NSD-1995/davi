import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors, HttpException, Header } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SchoolExperienceService } from './school-experience.service';
@Controller('school-experience')
export class SchoolExperienceController {
 constructor(private service:SchoolExperienceService){}
 private buckets=new Map<string,{at:number;count:number}>();
 private throttle(key:string){const now=Date.now();for(const [k,v] of this.buckets)if(now-v.at>60000)this.buckets.delete(k);if(this.buckets.size>10000)throw new HttpException('Try again later.',429);const b=this.buckets.get(key)||{at:now,count:0};if(++b.count>60)throw new HttpException('Try again later.',429);this.buckets.set(key,b);}
 @Get('public/:slug') publicSchool(@Req()r:any,@Param('slug')slug:string,@Res({passthrough:true})res:any){this.throttle('public:'+r.ip);res.setHeader('Cache-Control','no-store');if(slug.length>80)throw new BadRequestException('School unavailable.');return this.service.publicSchool(slug);}
 @Get('public-media/:id') async publicMedia(@Req()r:any,@Param('id')id:string,@Res()res:any){this.throttle('asset:'+r.ip);const {row,buffer}=await this.service.asset(id);res.set({'Content-Type':row.mimeType,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"});res.send(buffer);}
 @Get('branding') @UseGuards(JwtAuthGuard) @Header('Cache-Control','private, no-store') branding(@Req()r:any){return this.service.branding(r.user);}
 @Patch('branding') @UseGuards(JwtAuthGuard) @Header('Cache-Control','private, no-store') saveBrand(@Req()r:any,@Body()d:any){return this.service.saveBrand(r.user,d);}
 @Post('media') @UseGuards(JwtAuthGuard) @Header('Cache-Control','private, no-store') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:5*1024*1024,files:1,fields:3}})) upload(@Req()r:any,@Body()d:any,@UploadedFile()f:any){this.throttle('upload:'+r.user.id);return this.service.upload(r.user,d.category,d.ownerUserId,f);}
 @Get('media/:id/metadata') @UseGuards(JwtAuthGuard) @Header('Cache-Control','private, no-store') async metadata(@Req()r:any,@Param('id')id:string){const {row}=await this.service.asset(id,r.user);return this.service.metadata(row);}
 @Get('media/:id') @UseGuards(JwtAuthGuard) @Header('Cache-Control','private, no-store') async media(@Req()r:any,@Param('id')id:string,@Res()res:any){const {row,buffer}=await this.service.asset(id,r.user);res.set({'Content-Type':row.mimeType,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.send(buffer);}
 @Delete('media/:id') @UseGuards(JwtAuthGuard) @Header('Cache-Control','private, no-store') remove(@Req()r:any,@Param('id')id:string){return this.service.remove(r.user,id);}
 @Get('photo/:userId') @UseGuards(JwtAuthGuard) @Header('Cache-Control','private, no-store') photo(@Req()r:any,@Param('userId')id:string){return this.service.photo(r.user,id);}
 @Get('team') @UseGuards(JwtAuthGuard) @Header('Cache-Control','private, no-store') team(@Req()r:any){return this.service.team(r.user);}
 @Post('team') @UseGuards(JwtAuthGuard) @Header('Cache-Control','private, no-store') saveTeam(@Req()r:any,@Body()d:any){return this.service.saveTeam(r.user,d);}
 @Patch('team/:id') @UseGuards(JwtAuthGuard) @Header('Cache-Control','private, no-store') updateTeam(@Req()r:any,@Param('id')id:string,@Body()d:any){return this.service.saveTeam(r.user,d,id);}
 @Get('slug') @UseGuards(JwtAuthGuard) @Header('Cache-Control','private, no-store') availability(@Req()r:any,@Query('value')value:string){this.throttle('slug:'+r.user.id);return this.service.availability(r.user,value);}
 @Patch('slug') @UseGuards(JwtAuthGuard) @Header('Cache-Control','private, no-store') rename(@Req()r:any,@Body()d:any){return this.service.rename(r.user,d);}
}
