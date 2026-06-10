#!/bin/sh
# Test kernel patched Mac auto-switch
# Reset USB to initial state, let kernel re-detect Mac
LOG=/tmp/patched_switch_test.log
echo "=== Patched kernel switch test ===" > $LOG
date >> $LOG

# Reset to mass_storage (initial boot state)
echo "Resetting to mass_storage (025E)..." >> $LOG
echo 0 > /sys/class/android_usb/android0/enable
sleep 0.5
echo "mass_storage" > /sys/class/android_usb/android0/functions
echo 025E > /sys/class/android_usb/android0/idProduct
echo 1BBB > /sys/class/android_usb/android0/idVendor
sleep 0.5
echo 1 > /sys/class/android_usb/android0/enable
echo "Enabled mass_storage, waiting for kernel Mac detection..." >> $LOG

# Wait for kernel to detect Mac and auto-switch
sleep 10

echo "=== Result ===" >> $LOG
echo "functions: $(cat /sys/class/android_usb/android0/functions)" >> $LOG
echo "idProduct: $(cat /sys/class/android_usb/android0/idProduct)" >> $LOG
echo "state: $(cat /sys/class/android_usb/android0/state)" >> $LOG
ifconfig -a 2>/dev/null | grep "^ecm" >> $LOG
echo "=== dmesg (last jrd_usb entries) ===" >> $LOG
dmesg | grep "jrd_usb_config\|jrd_usb_switch" | tail -20 >> $LOG
echo "=== DONE ===" >> $LOG
