using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;

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

            private ushort wReserved;

            private int dwPageSize;

            private IntPtr lpMinimumApplicationAddress;

            private IntPtr lpMaximumApplicationAddress;

            private IntPtr dwActiveProcessorMask;

            private int dwNumberOfProcessors;

            private int dwProcessorType;

            private int dwAllocationGranularity;

            private short wProcessorLevel;

            private short wProcessorRevision;
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
