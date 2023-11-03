using System;
using System.Reflection;
using System.Runtime.InteropServices;

namespace Musiche.Utils
{
    public class Processor
    {
        public enum ProcessorArchitecture : ushort
        {
            x86 = 0,
            x64 = 9,
            ARM64 = 12,
            Unknown = ushort.MaxValue
        }

        private struct SYSTEM_INFO
        {
            internal ushort wProcessorArchitecture;

            private readonly ushort wReserved;

            private readonly int dwPageSize;

            private readonly IntPtr lpMinimumApplicationAddress;

            private readonly IntPtr lpMaximumApplicationAddress;

            private readonly IntPtr dwActiveProcessorMask;

            private readonly int dwNumberOfProcessors;

            private readonly int dwProcessorType;

            private readonly int dwAllocationGranularity;

            private readonly short wProcessorLevel;

            private readonly short wProcessorRevision;
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern void GetSystemInfo(out SYSTEM_INFO lpSystemInfo);

        public static ProcessorArchitecture GetArchitecture()
        {
            GetSystemInfo(out var lpSystemInfo);
            return (ProcessorArchitecture)lpSystemInfo.wProcessorArchitecture;
        }

        public static bool IsDotNetFramework()
        {
            return typeof(object).Assembly.GetCustomAttribute<AssemblyProductAttribute>().Product.Contains(".NET Framework");
        }

    }
}
