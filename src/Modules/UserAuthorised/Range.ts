'use strict';

// External Modules
import { r as RethinkDB } from 'rethinkdb-ts';

// Types
import { RDatum } from 'rethinkdb-ts';
import { PermissionSystem, Permission, UserRoles } from 'src/Modules';
import { RangePermissionParameter, PermissionParameterEvaluation } from './';

// Constants
import
{
	NEGATED,
	NOT_NEGATED,
	NOT_DELETED
} from 'src/Modules/Constants';

export function generateUserAuthorisedByRangeQuery <GenericPermissionTypes extends Array<string>, GenericTargetEntityType extends string>
(
	{domainId, userRoles, permissions, parameter, system}:
	{
		domainId: string | RDatum <string>,
		userRoles: RDatum <UserRoles <GenericTargetEntityType>>,
		permissions: RDatum <GenericPermissionTypes>,
		parameter: RDatum <RangePermissionParameter <any>>,
		system: PermissionSystem <any, any, any, any>
	}
)
{
	const query: RDatum <PermissionParameterEvaluation> = RethinkDB
		.expr
		(
			{
				granted: userRoles
					.concatMap
					(
						role => RethinkDB
							.table<Permission <any>>(system.table)
							.getAll
							(
								RethinkDB.args
								(
									permissions.map
									(
										permissionType => [ domainId, permissionType, NOT_NEGATED, role('id'), role('type'), NOT_DELETED ]
									) as unknown as Array <string>
								),
								{ index: system.indexes.range }
							)
					)
					.count()
					.gt(0),
				negated: userRoles
					.concatMap
					(
						role => RethinkDB
							.table<Permission <any>>(system.table)
							.getAll
							(
								RethinkDB.args
								(
									permissions.map
									(
										permissionType => [ domainId, permissionType, NEGATED, role('id'), role('type'), NOT_DELETED ]
									) as unknown as Array <string>
								),
								{ index: system.indexes.range }
							)
					)
					.group('type')
					.ungroup()
					.count()
					.lt(permissions.length),
				parameter
			}
		)
		.merge
		(
			(evaluations: RDatum<PermissionParameterEvaluation>) =>
			(
				{
					authorised: RethinkDB.and
					(
						evaluations('granted').eq(true),
						evaluations('negated').eq(false)
					)
				}
			)
		);
	return query;
};