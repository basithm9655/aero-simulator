#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
Adafruit_MPU6050 mpu;
float rollDeg=0,pitchDeg=0,yawDeg=0;
unsigned long lastUs=0;
void setup(){
  Serial.begin(115200); Wire.begin(21,22);
  if(!mpu.begin()) while(true) delay(100);
  mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  lastUs=micros();
}
void loop(){
  sensors_event_t a,g,t; mpu.getEvent(&a,&g,&t);
  unsigned long now=micros(); float dt=(now-lastUs)/1000000.0f; lastUs=now;
  if(dt<=0 || dt>0.05f) dt=0.01f;
  float ar=atan2(a.acceleration.y,a.acceleration.z)*180.0f/PI;
  float ap=atan2(-a.acceleration.x,sqrt(a.acceleration.y*a.acceleration.y+a.acceleration.z*a.acceleration.z))*180.0f/PI;
  float gx=g.gyro.x*180.0f/PI, gy=g.gyro.y*180.0f/PI, gz=g.gyro.z*180.0f/PI;
  rollDeg=0.98f*(rollDeg+gx*dt)+0.02f*ar;
  pitchDeg=0.98f*(pitchDeg+gy*dt)+0.02f*ap;
  yawDeg+=gz*dt; if(yawDeg>180)yawDeg-=360; if(yawDeg<-180)yawDeg+=360;
  Serial.printf("{\"roll\":%.2f,\"pitch\":%.2f,\"yaw\":%.2f}\n",rollDeg,pitchDeg,yawDeg);
  delay(10);
}