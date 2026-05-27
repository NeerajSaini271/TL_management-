export var Role;
(function (Role) { Role['ADMIN'] = 'ADMIN'; Role['MANAGER'] = 'MANAGER'; Role['TL'] = 'TL'; Role['EMPLOYEE'] = 'EMPLOYEE'; })(Role || (Role = {}));
export var RoleHierarchy = {};
RoleHierarchy[Role.ADMIN] = 4; RoleHierarchy[Role.MANAGER] = 3; RoleHierarchy[Role.TL] = 2; RoleHierarchy[Role.EMPLOYEE] = 1;
