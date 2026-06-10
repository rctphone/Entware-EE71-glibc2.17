#!/bin/sh
# Test: reset USB to initial PID 025E (mass_storage), let kernel auto-switch for Mac
LOG=/tmp/kernel_patch_test.log
echo "=== Kernel patch test ===" > $LOG
date >> $LOG

echo "Resetting to initial mass_storage (025E)..." >> $LOG
echo 0 > /sys/class/android_usb/android0/enable
echo "mass_storage" > /sys/class/android_usb/android0/functions
echo 025E > /sys/class/android_usb/android0/idProduct
sleep 1
echo 1 > /sys/class/android_usb/android0/enable

echo "Waiting 8s for kernel Mac auto-switch..." >> $LOG
sleep 8

echo "=== Result ===" >> $LOG
echo "functions: $(cat /sys/class/android_usb/android0/functions)" >> $LOG
echo "idProduct: $(cat /sys/class/android_usb/android0/idProduct)" >> $LOG
echo "state: $(cat /sys/class/android_usb/android0/state)" >> $LOG
echo "interfaces:" >> $LOG
ifconfig -a 2>/dev/null | grep "^ecm" >> $LOG
echo "=== dmesg ===" >> $LOG
dmesg | grep "jrd_usb" | tail -20 >> $LOG
echo "=== DONE ===" >> $LOG
