﻿using System;
using System.Runtime.InteropServices;

namespace Musiche.Utils
{
    public static class OSVersion
    {
        private static readonly Version _osVersion = GetOSVersion();

        public static bool IsWindowsNT { get; } = Environment.OSVersion.Platform == PlatformID.Win32NT;

        public static bool IsWindows7OrLess { get; } = (Environment.OSVersion.Version.Major < 6 ||
                (Environment.OSVersion.Version.Major == 6 &&
                Environment.OSVersion.Version.Minor <= 1));

        public static bool IsWindows8OrGreater { get; } = IsWindowsNT && _osVersion >= new Version(6, 2);

        public static bool IsWindows10OrGreater { get; } = IsWindowsNT && _osVersion >= new Version(10, 0);

        public static bool IsWindows11OrGreater { get; } = IsWindowsNT && _osVersion >= new Version(10, 0, 22000);

        public static bool IsSupportMica { get; } = IsWindowsNT && _osVersion >= new Version(10, 0, 21996);

        private static Version GetOSVersion()
        {
            var osv = new RTL_OSVERSIONINFOEX();
            osv.dwOSVersionInfoSize = (uint)Marshal.SizeOf(osv);
            _ = RtlGetVersion(out osv);
            return new Version((int)osv.dwMajorVersion, (int)osv.dwMinorVersion, (int)osv.dwBuildNumber);
        }

        [DllImport("ntdll.dll")]
        private static extern int RtlGetVersion(out RTL_OSVERSIONINFOEX lpVersionInformation);

        [StructLayout(LayoutKind.Sequential)]
        private struct RTL_OSVERSIONINFOEX
        {
            internal uint dwOSVersionInfoSize;
            internal uint dwMajorVersion;
            internal uint dwMinorVersion;
            internal uint dwBuildNumber;
            internal uint dwPlatformId;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
            internal string szCSDVersion;
        }
    }
}
