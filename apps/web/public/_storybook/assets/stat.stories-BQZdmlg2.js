import{bg as a,j as e,ag as u,bh as n}from"./iframe-BjN4PNZi.js";import{C as m}from"./clock-CLisaoUw.js";import{B as b}from"./bug-D_gBXHGa.js";import{U as g}from"./users-CrbWFYk8.js";import"./preload-helper-PPVm8Dsz.js";const i=[12,18,14,22,19,25,28,24,31,29,34,38,36,42],p=[5.2,4.9,5.4,4.6,4.4,4.8,4.1,3.9,4.2,3.7,3.6,3.8,3.5,3.4],v=[8,9,11,10,12,14,13,15,17,16,18,21,20,23],k={title:"Data display/Stat",component:a,tags:["autodocs"],args:{label:"Issues closed",value:"342",delta:12.4,deltaLabel:"vs last cycle",invertDelta:!1,sparkline:i,bare:!1},decorators:[s=>e.jsx("div",{className:"w-64",children:e.jsx(s,{})})],parameters:{docs:{description:{component:"A metric card: the number, its label, the change versus the previous period (green\nwhen it is good, red when bad; set `invertDelta` when lower is better) and a sparkline."}}}},l={},r={decorators:[s=>e.jsx(s,{})],render:()=>e.jsxs("div",{className:"grid w-[800px] grid-cols-3 gap-3",children:[e.jsx(a,{label:"Throughput",value:"342",delta:12.4,deltaLabel:"vs last cycle"}),e.jsx(a,{label:"Scope added",value:"58",delta:-8,deltaLabel:"vs last cycle"}),e.jsx(a,{label:"Carry-over",value:"11",delta:0,deltaLabel:"vs last cycle"})]})},t={args:{label:"Median cycle time",value:"3.4d",delta:-18.2,invertDelta:!0,sparkline:p,icon:e.jsx(m,{})}},c={args:{sparkline:void 0,icon:e.jsx(u,{})}},o={decorators:[s=>e.jsx(s,{})],render:()=>e.jsxs("div",{className:"flex items-center gap-6",children:[e.jsx(n,{data:i,label:"Issues closed per day"}),e.jsx(n,{data:v,className:"text-danger",area:!1}),e.jsx(n,{data:p,className:"text-success",width:160,height:40})]})},d={decorators:[s=>e.jsx(s,{})],render:()=>e.jsxs("div",{className:"grid w-[880px] grid-cols-4 gap-3",children:[e.jsx(a,{icon:e.jsx(u,{}),label:"Issues closed",value:"342",delta:12.4,deltaLabel:"vs last cycle",sparkline:i}),e.jsx(a,{icon:e.jsx(m,{}),label:"Median cycle time",value:"3.4d",delta:-18.2,invertDelta:!0,deltaLabel:"vs last cycle",sparkline:p}),e.jsx(a,{icon:e.jsx(b,{}),label:"Open bugs",value:"23",delta:15,invertDelta:!0,deltaLabel:"vs last cycle",sparkline:v}),e.jsx(a,{icon:e.jsx(g,{}),label:"Active members",value:"48",delta:0,deltaLabel:"no change"})]})},L=["Playground","Deltas","LowerIsBetter","WithoutSparkline","SparklineOnly","Dashboard"];l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:"{}",...l.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  decorators: [Story => <Story />],
  render: () => <div className="grid w-[800px] grid-cols-3 gap-3">
      <Stat label="Throughput" value="342" delta={12.4} deltaLabel="vs last cycle" />
      <Stat label="Scope added" value="58" delta={-8} deltaLabel="vs last cycle" />
      <Stat label="Carry-over" value="11" delta={0} deltaLabel="vs last cycle" />
    </div>
}`,...r.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    label: "Median cycle time",
    value: "3.4d",
    delta: -18.2,
    invertDelta: true,
    sparkline: cycleTime,
    icon: <Clock />
  }
}`,...t.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    sparkline: undefined,
    icon: <CheckCircle2 />
  }
}`,...c.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  decorators: [Story => <Story />],
  render: () => <div className="flex items-center gap-6">
      <Sparkline data={closed} label="Issues closed per day" />
      <Sparkline data={bugs} className="text-danger" area={false} />
      <Sparkline data={cycleTime} className="text-success" width={160} height={40} />
    </div>
}`,...o.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  decorators: [Story => <Story />],
  render: () => <div className="grid w-[880px] grid-cols-4 gap-3">
      <Stat icon={<CheckCircle2 />} label="Issues closed" value="342" delta={12.4} deltaLabel="vs last cycle" sparkline={closed} />
      <Stat icon={<Clock />} label="Median cycle time" value="3.4d" delta={-18.2} invertDelta deltaLabel="vs last cycle" sparkline={cycleTime} />
      <Stat icon={<Bug />} label="Open bugs" value="23" delta={15} invertDelta deltaLabel="vs last cycle" sparkline={bugs} />
      <Stat icon={<Users />} label="Active members" value="48" delta={0} deltaLabel="no change" />
    </div>
}`,...d.parameters?.docs?.source}}};export{d as Dashboard,r as Deltas,t as LowerIsBetter,l as Playground,o as SparklineOnly,c as WithoutSparkline,L as __namedExportsOrder,k as default};
